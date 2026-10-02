import { connection } from 'next/server'
import { Suspense } from 'react'

import { Card, CardTitle } from '@/components/atoms/card'
import { ChannelSelector, type SelectorGroup } from '@/components/molecules/channel-selector'
import { GoalKpiCard } from '@/components/molecules/goal-kpi-card'
import { GroupCreator } from '@/components/molecules/group-creator'
import { MetricTabs } from '@/components/molecules/metric-tabs'
import { PeriodPicker } from '@/components/molecules/period-picker'
import { PeriodSummary } from '@/components/molecules/period-summary'
import { ProjectionNote } from '@/components/molecules/projection-note'
import { RatioTabs } from '@/components/molecules/ratio-tabs'
import { ScopeNotice, type ScopeSelection } from '@/components/molecules/scope-notice'
import { BurnupChart } from '@/components/organisms/burnup-chart'
import { ChannelConversionTable } from '@/components/organisms/channel-conversion-table'
import { ChannelGoalTable } from '@/components/organisms/channel-goal-table'
import { ChannelStatusSummary } from '@/components/organisms/channel-status-summary'
import { ChannelTrendGrid } from '@/components/organisms/channel-trend-grid'
import { ChannelValueTable } from '@/components/organisms/channel-value-table'
import { DataError } from '@/components/organisms/data-error'
import { FunnelStagesChart } from '@/components/organisms/funnel-stages-chart'
import { DashboardShell } from '@/components/templates/dashboard-shell'
import {
  GROUP_CREATION_MESSAGES,
  GROUP_FORM_FIELDS,
  groupKey,
  isGroupCreationError,
  MAX_GROUP_NAME_LENGTH,
  removeCustomGroup,
  resolveGroupParam,
  restrictSections,
  selectableGroups,
} from '@/lib/channel-groups'
import {
  dashboardSearchParams,
  parseDashboardParams,
  resolveChannelParam,
  type DashboardParams,
} from '@/lib/dashboard-params'
import { groupSections, resolveChannels } from '@/lib/data/channel-catalog'
import { computeRatioMatrix } from '@/lib/data/funnel-efficiency'
import { applyFunnelQuery, listChannels, sumMetrics } from '@/lib/data/funnel-query'
import {
  getChannels,
  getFunnelSnapshots,
  getFunnelSource,
  getGoals,
} from '@/lib/data/funnel-service'
import {
  buildConversionWeeks,
  buildStageData,
  buildTrendData,
  conversionWeekDeltas,
  MAX_SEMANAS_EXIBIDAS,
  sortByUrgency,
  summarizeChannelStatus,
  trendGranularity,
} from '@/lib/data/funnel-view'
import { computeAdherence, dataRangeWithComparisonFor, firstDataDate } from '@/lib/data/goal-math'
import { computePeriodComparison } from '@/lib/data/period-comparison'
import { FUNNEL_RATIO_DEFINITIONS } from '@/lib/data/types'
import { single, todayInBusinessTimezone } from '@/lib/period'
import { channelColors } from '@/lib/series-colors'

export default function Page({ searchParams }: PageProps<'/'>) {
  return (
    <DashboardShell
      title="Canais Orgânicos"
      subtitle="Aderência à meta de receita, MQLs, oportunidades e clientes por canal."
      source={getFunnelSource()}
    >
      <Suspense fallback={<DashboardSkeleton />}>
        <Adherence searchParams={searchParams} />
      </Suspense>
    </DashboardShell>
  )
}

/**
 * Único ponto do app que lê dados e relógio.
 *
 * `connection()` marca o limite do prerender: daqui para baixo tudo roda em
 * tempo de request. É o que permite ler a data de hoje sem que ela congele
 * junto com o cache de uma hora dos snapshots.
 */
async function Adherence({ searchParams }: { searchParams: PageProps<'/'>['searchParams'] }) {
  await connection()

  const today = todayInBusinessTimezone()
  const params = await searchParams

  const parsed = parseDashboardParams(params, today)
  const { range, presetId, metric, ratio } = parsed

  let snapshots
  let goals
  let registeredChannels
  try {
    // O histórico buscado começa antes do período — o bastante para a janela de
    // tendência e para a janela equivalente anterior caberem — e nunca passa de
    // hoje: dado futuro não existe em fonte nenhuma. O intervalo é
    // determinístico, então continua sendo uma chave de cache e uma ida à fonte.
    ;[snapshots, goals, registeredChannels] = await Promise.all([
      getFunnelSnapshots(dataRangeWithComparisonFor(range, today)),
      getGoals(),
      getChannels(),
    ])
  } catch (error) {
    return <DataError message={error instanceof Error ? error.message : String(error)} />
  }

  const inPeriod = snapshots.filter(
    (snapshot) => snapshot.date >= range.from && snapshot.date <= range.to,
  )

  const catalog = resolveChannels(registeredChannels, listChannels(inPeriod))
  const channelOrder = catalog.channels.map((entry) => entry.channel)
  const channelLabels = Object.fromEntries(
    catalog.channels.map((entry) => [entry.channel, entry.label]),
  )
  const channelSections = groupSections(catalog)
  // Uma cor por canal, calculada uma vez sobre o catálogo inteiro: seletor,
  // gráficos e tabelas leem do mesmo mapa, e escolher um grupo não repinta nada.
  const colors = channelColors(catalog)

  // A validação de grupo e canal só fecha aqui: as listas válidas vêm do dado,
  // que o parser da URL ainda não tinha. Grupo tem precedência sobre canal —
  // os dois são o mesmo eixo, a seleção.
  const groups = selectableGroups(catalog, parsed.customGroups)
  const group = resolveGroupParam(parsed.group, groups)
  const channel = group ? null : resolveChannelParam(parsed.channel, channelOrder)
  const dashboard: DashboardParams = {
    ...parsed,
    channel,
    group: group?.name ?? null,
  }
  const channelLabel = channel === null ? null : (channelLabels[channel] ?? channel)

  const selection: ScopeSelection | null = group
    ? { kind: 'grupo', label: group.name, size: group.channels.length }
    : channelLabel
      ? { kind: 'canal', label: channelLabel }
      : null

  const report = computeAdherence({
    snapshots,
    goals,
    range,
    channels: channelOrder,
    focusChannel: channel,
    focusChannels: group?.channels ?? null,
  })
  const scope = report.scope

  // Com um grupo selecionado, os blocos de comparação mostram só os canais dele
  // — comparar dentro do grupo é o motivo de escolhê-lo. Com um canal só, seguem
  // completos (decisão 0006). Ver docs/decisions/0010.
  const visible = group ? new Set(group.channels) : null
  const inView = (key: string) => visible === null || visible.has(key)
  const visibleOrder = channelOrder.filter(inView)
  const visibleInPeriod = inPeriod.filter((snapshot) => inView(snapshot.channel))
  const visibleSections = visible ? restrictSections(channelSections, visible) : channelSections
  const visibleAdherence = report.byChannel.filter((entry) => inView(entry.channel))

  // A tabela de aderência abre pelo canal mais urgente: com dez ou quinze
  // canais, na ordem do cadastro o canal em risco podia estar na linha 40.
  const byChannel = sortByUrgency(visibleAdherence, channelOrder)
  const statusSummary = summarizeChannelStatus(visibleAdherence, channelOrder)

  const scopedSnapshots = group
    ? visibleInPeriod
    : channel === null
      ? inPeriod
      : applyFunnelQuery(inPeriod, { channels: [channel] })

  const conversion = computeRatioMatrix({
    periodSnapshots: visibleInPeriod,
    goals,
    channels: visibleOrder,
    timing: report.timing,
  })

  const comparison = computePeriodComparison({
    snapshots,
    timing: report.timing,
    firstDataDate: firstDataDate(snapshots),
    channels: channelOrder,
  })

  // As semanas saem do conjunto largo, não do recorte: é o que permite a
  // primeira semana se completar com os dias anteriores ao período em vez de
  // aparecer truncada.
  const weeks = buildConversionWeeks(
    visible ? snapshots.filter((snapshot) => inView(snapshot.channel)) : snapshots,
    ratio,
    range,
    report.timing.lastDataDate,
    visibleOrder,
  )

  // Todo card diz de quem são os números que mostra. Os agregados seguem a
  // seleção; os de comparação, só o grupo — canal único não os recorta.
  const aggregateScope = group
    ? `Grupo ${group.name} · ${group.channels.length} ${group.channels.length === 1 ? 'canal' : 'canais'}`
    : (channelLabel ?? 'Todos os canais')
  const comparisonScope = group ? `Grupo ${group.name}` : 'Todos os canais'
  const totalLabel = group ? `Total de ${group.name}` : 'Consolidado'

  // Todo link do seletor parte do estado atual sem canal nem grupo, e leva
  // junto os grupos personalizados — trocar de seleção não pode apagá-los.
  const selectionBase = dashboardSearchParams(dashboard, ['canal', 'grupo'])
  const selectorLabel = group
    ? `Grupo: ${group.name}`
    : channelLabel
      ? `Canal: ${channelLabel}`
      : 'Todos os canais'
  const selectorGroups: SelectorGroup[] = groups.map((entry) => ({
    name: entry.name,
    size: entry.channels.length,
    source: entry.source,
    active: group !== null && groupKey(group.name) === groupKey(entry.name),
    href: { ...selectionBase, grupo: entry.name },
    removeHref: entry.source === 'personalizado' ? removalQuery(dashboard, entry.name) : null,
  }))

  const notice = single(params.aviso)
  const warning = isGroupCreationError(notice) ? GROUP_CREATION_MESSAGES[notice] : null
  return (
    <>
      <div className="space-y-3">
        <PeriodPicker
          current={presetId}
          range={range}
          baseQuery={dashboardSearchParams(dashboard, ['periodo'])}
        />
        <div className="flex flex-wrap items-center gap-2">
          <ChannelSelector
            currentLabel={selectorLabel}
            baseQuery={selectionBase}
            groups={selectorGroups}
            sections={channelSections}
            currentChannel={channel}
            allSelected={selection === null}
            colors={colors}
          />
          <GroupCreator
            baseQuery={selectionBase}
            sections={channelSections}
            colors={colors}
            fields={GROUP_FORM_FIELDS}
            maxNameLength={MAX_GROUP_NAME_LENGTH}
            warning={warning}
          />
        </div>
        <PeriodSummary
          timing={report.timing}
          missingGoalMonths={report.missingGoalMonths}
          unregisteredChannels={catalog.unregistered}
          comparison={comparison}
        />
        <ScopeNotice selection={selection} />
      </div>

      {inPeriod.length === 0 ? (
        <DataError message="Não há nenhuma linha de funil no período selecionado." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {scope.metrics.map((adherence) => (
              <GoalKpiCard key={adherence.metric} adherence={adherence} />
            ))}
          </div>

          <Card>
            <CardTitle
              hint={`${comparisonScope} · cada canal no seu pior status entre as quatro métricas`}
            >
              Situação dos canais
            </CardTitle>
            <ChannelStatusSummary
              groups={statusSummary}
              labels={channelLabels}
              colors={colors}
              current={channel}
              baseQuery={selectionBase}
            />
          </Card>

          {/* Os dois blocos que o foco escopa ficam juntos, logo abaixo dos cartões. */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <CardTitle
                  hint={`${aggregateScope} · acumulado no período contra a meta, com a continuação no ritmo atual`}
                >
                  Aderência acumulada
                </CardTitle>
                <MetricTabs
                  current={metric}
                  baseQuery={dashboardSearchParams(dashboard, ['metrica'])}
                />
              </div>

              <BurnupChart
                points={report.burnup[metric]}
                anchorDate={report.timing.lastDataDate}
                metric={metric}
              />
              <ProjectionNote
                confidence={scope.metrics.find((entry) => entry.metric === metric)!.confidence}
              />
            </Card>

            <Card>
              <CardTitle hint={`${aggregateScope} · total acumulado no período, por etapa`}>
                Etapas do funil
              </CardTitle>
              <FunnelStagesChart stages={buildStageData(sumMetrics(scopedSnapshots))} />
            </Card>
          </div>

          <Card>
            <CardTitle
              hint={`${comparisonScope} · meta rateada por dias úteis · do canal mais urgente ao menos`}
            >
              Aderência por canal
            </CardTitle>
            <ChannelGoalTable
              channels={byChannel}
              catalog={catalog}
              colors={colors}
              highlight={channel}
              comparison={comparison}
            />
          </Card>

          <Card>
            <CardTitle
              hint={`${comparisonScope} · MQLs por ${GRANULARITY_LABEL[trendGranularity(range)]}`}
            >
              Evolução por canal
            </CardTitle>
            <ChannelTrendGrid
              trend={buildTrendData(visibleInPeriod, trendGranularity(range))}
              sections={visibleSections}
              colors={colors}
              highlight={channel}
            />
          </Card>

          <Card>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <CardTitle
                hint={`${comparisonScope} · ${FUNNEL_RATIO_DEFINITIONS[ratio].label} · semanas completas de segunda a domingo, até ${MAX_SEMANAS_EXIBIDAS} mais recentes`}
              >
                Taxas de conversão
              </CardTitle>
              <RatioTabs current={ratio} baseQuery={dashboardSearchParams(dashboard, ['taxa'])} />
            </div>

            <ChannelConversionTable
              ratio={ratio}
              rows={conversion.byChannel}
              total={conversion.total}
              weeks={weeks}
              delta={conversionWeekDeltas(weeks)}
              colors={colors}
              labels={channelLabels}
              highlight={channel}
              totalLabel={totalLabel}
            />
          </Card>

          <Card>
            <CardTitle hint={`${comparisonScope} · receita e clientes do período`}>
              Valor por canal
            </CardTitle>
            <ChannelValueTable
              rows={conversion.byChannel}
              total={conversion.total}
              colors={colors}
              labels={channelLabels}
              highlight={channel}
              totalLabel={totalLabel}
            />
          </Card>
        </>
      )}
    </>
  )
}

const GRANULARITY_LABEL = {
  diaria: 'dia',
  semanal: 'semana',
  mensal: 'mês',
} as const

/**
 * Links que tiram um grupo personalizado da URL.
 *
 * Se o grupo removido era o selecionado, a seleção cai junto — sobraria um
 * `grupo=` apontando para nada.
 */
function removalQuery(dashboard: DashboardParams, name: string): Record<string, string> {
  const selected = dashboard.group !== null && groupKey(dashboard.group) === groupKey(name)

  return dashboardSearchParams({
    ...dashboard,
    customGroups: removeCustomGroup(dashboard.customGroups, name),
    group: selected ? null : dashboard.group,
  })
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <div className="bg-surface ring-hairline h-10 rounded-xl ring-1" />
      <div className="bg-surface ring-hairline h-8 rounded-xl ring-1" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="bg-surface ring-hairline h-28 rounded-xl ring-1" />
        ))}
      </div>
      <div className="bg-surface ring-hairline h-40 rounded-xl ring-1" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="bg-surface ring-hairline h-96 rounded-xl ring-1 lg:col-span-2" />
        <div className="bg-surface ring-hairline h-96 rounded-xl ring-1" />
      </div>
      <div className="bg-surface ring-hairline h-96 rounded-xl ring-1" />
      <div className="bg-surface ring-hairline h-80 rounded-xl ring-1" />
      <div className="bg-surface ring-hairline h-64 rounded-xl ring-1" />
      <div className="bg-surface ring-hairline h-56 rounded-xl ring-1" />
    </div>
  )
}
