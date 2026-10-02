import { connection } from 'next/server'
import { Suspense } from 'react'

import { Card, CardTitle } from '@/components/atoms/card'
import { ChannelPicker } from '@/components/molecules/channel-picker'
import { GoalKpiCard } from '@/components/molecules/goal-kpi-card'
import { MetricTabs } from '@/components/molecules/metric-tabs'
import { PeriodPicker } from '@/components/molecules/period-picker'
import { PeriodSummary } from '@/components/molecules/period-summary'
import { ProjectionNote } from '@/components/molecules/projection-note'
import { RatioTabs } from '@/components/molecules/ratio-tabs'
import { ScopeNotice } from '@/components/molecules/scope-notice'
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
  dashboardSearchParams,
  parseDashboardParams,
  resolveChannelParam,
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
import { todayInBusinessTimezone } from '@/lib/period'
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
  // Uma cor por grupo, calculada uma vez: seletor, gráficos e tabelas leem do
  // mesmo mapa, então a cor de um canal nunca discorda entre dois blocos.
  const colors = channelColors(catalog)

  // A validação do canal só fecha aqui: a lista de canais válidos vem do dado,
  // que o parser da URL ainda não tinha.
  const channel = resolveChannelParam(parsed.channel, channelOrder)
  const dashboard = { ...parsed, channel }
  const channelLabel = channel === null ? null : (channelLabels[channel] ?? channel)

  const report = computeAdherence({
    snapshots,
    goals,
    range,
    channels: channelOrder,
    focusChannel: channel,
  })

  // A tabela de aderência abre pelo canal mais urgente: com dez ou quinze
  // canais, na ordem do cadastro o canal em risco podia estar na linha 40.
  const byChannel = sortByUrgency(report.byChannel, channelOrder)
  const statusSummary = summarizeChannelStatus(report.byChannel, channelOrder)

  // O escopo muda os agregados do topo, nunca as tabelas de comparação: filtrar
  // uma tabela de comparação para uma linha só destrói o que a torna útil.
  const scope =
    channel === null
      ? report.total
      : (byChannel.find((entry) => entry.channel === channel) ?? report.total)
  const scopedSnapshots =
    channel === null ? inPeriod : applyFunnelQuery(inPeriod, { channels: [channel] })

  const conversion = computeRatioMatrix({
    periodSnapshots: inPeriod,
    goals,
    channels: channelOrder,
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
    snapshots,
    ratio,
    range,
    report.timing.lastDataDate,
    channelOrder,
  )

  return (
    <>
      <div className="space-y-3">
        <PeriodPicker
          current={presetId}
          range={range}
          baseQuery={dashboardSearchParams(dashboard, ['periodo'])}
        />
        <ChannelPicker
          sections={channelSections}
          current={channel}
          baseQuery={dashboardSearchParams(dashboard, ['canal'])}
          colors={colors}
        />
        <PeriodSummary
          timing={report.timing}
          missingGoalMonths={report.missingGoalMonths}
          unregisteredChannels={catalog.unregistered}
          comparison={comparison}
        />
        <ScopeNotice channelLabel={channelLabel} />
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
            <CardTitle hint="Todos os canais · cada canal no seu pior status entre as quatro métricas">
              Situação dos canais
            </CardTitle>
            <ChannelStatusSummary
              groups={statusSummary}
              labels={channelLabels}
              colors={colors}
              current={channel}
              baseQuery={dashboardSearchParams(dashboard, ['canal'])}
            />
          </Card>

          {/* Os dois blocos que o foco escopa ficam juntos, logo abaixo dos cartões. */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <CardTitle
                  hint={`${scopeHint(channelLabel)} · acumulado no período contra a meta, com a continuação no ritmo atual`}
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
              <CardTitle
                hint={`${scopeHint(channelLabel)} · total acumulado no período, por etapa`}
              >
                Etapas do funil
              </CardTitle>
              <FunnelStagesChart stages={buildStageData(sumMetrics(scopedSnapshots))} />
            </Card>
          </div>

          <Card>
            <CardTitle hint="Todos os canais · meta rateada por dias úteis · do canal mais urgente ao menos">
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
              hint={`Todos os canais · MQLs por ${GRANULARITY_LABEL[trendGranularity(range)]}`}
            >
              Evolução por canal
            </CardTitle>
            <ChannelTrendGrid
              trend={buildTrendData(inPeriod, trendGranularity(range))}
              sections={channelSections}
              colors={colors}
              highlight={channel}
            />
          </Card>

          <Card>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <CardTitle
                hint={`Todos os canais · ${FUNNEL_RATIO_DEFINITIONS[ratio].label} · semanas completas de segunda a domingo, até ${MAX_SEMANAS_EXIBIDAS} mais recentes`}
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
            />
          </Card>

          <Card>
            <CardTitle hint="Todos os canais · receita e clientes do período">
              Valor por canal
            </CardTitle>
            <ChannelValueTable
              rows={conversion.byChannel}
              total={conversion.total}
              colors={colors}
              labels={channelLabels}
              highlight={channel}
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
 * Primeiro pedaço do `hint` de um card, nomeando o escopo.
 *
 * Todo card diz de quem são os números que mostra. É a regra que impede o
 * filtro de canal de criar um dashboard em que metade dos blocos mudou de
 * significado e a outra metade não, sem nada na tela dizendo qual é qual.
 */
function scopeHint(channelLabel: string | null): string {
  return channelLabel ?? 'Todos os canais'
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
