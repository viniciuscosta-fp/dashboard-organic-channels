import { connection } from 'next/server'
import { Suspense } from 'react'

import { Card, CardTitle } from '@/components/atoms/card'
import { GoalKpiCard } from '@/components/molecules/goal-kpi-card'
import { MetricTabs } from '@/components/molecules/metric-tabs'
import { PeriodPicker } from '@/components/molecules/period-picker'
import { PeriodSummary } from '@/components/molecules/period-summary'
import { BurnupChart } from '@/components/organisms/burnup-chart'
import { ChannelGoalTable } from '@/components/organisms/channel-goal-table'
import { ChannelTrendChart } from '@/components/organisms/channel-trend-chart'
import { DataError } from '@/components/organisms/data-error'
import { FunnelStagesChart } from '@/components/organisms/funnel-stages-chart'
import { DashboardShell } from '@/components/templates/dashboard-shell'
import { resolveChannels } from '@/lib/data/channel-catalog'
import { listChannels, sumMetrics } from '@/lib/data/funnel-query'
import {
  getChannels,
  getFunnelSnapshots,
  getFunnelSource,
  getGoals,
} from '@/lib/data/funnel-service'
import { buildStageData, buildTrendData, trendGranularity } from '@/lib/data/funnel-view'
import { computeAdherence, dataRangeFor } from '@/lib/data/goal-math'
import { isMetric, METRIC_LABELS, type Metric } from '@/lib/data/types'
import { parsePeriod, periodSearchParams, todayInBusinessTimezone } from '@/lib/period'

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

  const { range, presetId } = parsePeriod(params, today)
  const metric: Metric = isMetric(params.metrica) ? params.metrica : 'revenue'
  const periodQuery = periodSearchParams(presetId ?? range)

  let snapshots
  let goals
  let registeredChannels
  try {
    // O histórico buscado começa antes do período, para a janela de tendência
    // caber, e nunca passa de hoje — dado futuro não existe em fonte nenhuma.
    ;[snapshots, goals, registeredChannels] = await Promise.all([
      getFunnelSnapshots(dataRangeFor(range, today)),
      getGoals(),
      getChannels(),
    ])
  } catch (error) {
    return <DataError message={error instanceof Error ? error.message : String(error)} />
  }

  const report = computeAdherence({ snapshots, goals, range })
  const inPeriod = snapshots.filter(
    (snapshot) => snapshot.date >= range.from && snapshot.date <= range.to,
  )

  const catalog = resolveChannels(registeredChannels, listChannels(inPeriod))
  const channelOrder = catalog.channels.map((entry) => entry.channel)
  const channelLabels = Object.fromEntries(
    catalog.channels.map((entry) => [entry.channel, entry.label]),
  )

  // A tabela segue a ordem do cadastro, não a ordem alfabética do cálculo.
  const byChannel = [...report.byChannel].sort(
    (a, b) => channelOrder.indexOf(a.channel) - channelOrder.indexOf(b.channel),
  )

  return (
    <>
      <div className="space-y-3">
        <PeriodPicker current={presetId} range={range} metric={metric} />
        <PeriodSummary
          timing={report.timing}
          missingGoalMonths={report.missingGoalMonths}
          unregisteredChannels={catalog.unregistered}
        />
      </div>

      {inPeriod.length === 0 ? (
        <DataError message="Não há nenhuma linha de funil no período selecionado." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {report.total.metrics.map((adherence) => (
              <GoalKpiCard key={adherence.metric} adherence={adherence} />
            ))}
          </div>

          <Card>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <CardTitle hint="Acumulado no período contra a meta, com a continuação no ritmo atual">
                Aderência acumulada
              </CardTitle>
              <MetricTabs current={metric} periodQuery={periodQuery} />
            </div>

            <BurnupChart
              points={report.burnup[metric]}
              anchorDate={report.timing.lastDataDate}
              metric={metric}
            />
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardTitle hint="Total acumulado no período, por etapa">Etapas do funil</CardTitle>
              <FunnelStagesChart stages={buildStageData(sumMetrics(inPeriod))} />
            </Card>

            <Card>
              <CardTitle hint={`MQLs por ${GRANULARITY_LABEL[trendGranularity(range)]}, por canal`}>
                Evolução por canal
              </CardTitle>
              <ChannelTrendChart
                trend={buildTrendData(inPeriod, trendGranularity(range))}
                channels={channelOrder}
                labels={channelLabels}
              />
            </Card>
          </div>

          <Card>
            <CardTitle
              hint={`Meta rateada por dias úteis · destaque em ${METRIC_LABELS[metric].toLowerCase()}`}
            >
              Aderência por canal
            </CardTitle>
            <ChannelGoalTable channels={byChannel} catalog={catalog} order={channelOrder} />
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

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <div className="bg-surface ring-hairline h-10 rounded-xl ring-1" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="bg-surface ring-hairline h-40 rounded-xl ring-1" />
        ))}
      </div>
      <div className="bg-surface ring-hairline h-96 rounded-xl ring-1" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-surface ring-hairline h-80 rounded-xl ring-1" />
        <div className="bg-surface ring-hairline h-80 rounded-xl ring-1" />
      </div>
    </div>
  )
}
