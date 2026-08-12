import { Suspense } from 'react'

import { Card, CardTitle } from '@/components/atoms/card'
import { KpiCard } from '@/components/molecules/kpi-card'
import { ChannelTable } from '@/components/organisms/channel-table'
import { ChannelTrendChart } from '@/components/organisms/channel-trend-chart'
import { DataError } from '@/components/organisms/data-error'
import { FunnelStagesChart } from '@/components/organisms/funnel-stages-chart'
import { DashboardShell } from '@/components/templates/dashboard-shell'
import { listChannels, sumFunnelStages } from '@/lib/data/funnel-query'
import { getFunnelSnapshots, getFunnelSource } from '@/lib/data/funnel-service'
import { buildChannelRows, buildStageData, buildTrendData } from '@/lib/data/funnel-view'
import { FUNNEL_STAGE_LABELS } from '@/lib/data/types'

export default function Page() {
  return (
    <DashboardShell
      title="Canais Orgânicos"
      subtitle="Funil de MQLs, oportunidades e clientes por canal de origem."
      source={getFunnelSource()}
    >
      <Suspense fallback={<FunnelSkeleton />}>
        <FunnelSection />
      </Suspense>
    </DashboardShell>
  )
}

/**
 * Único ponto do app que lê dados.
 *
 * A busca fica no nível da rota, e não dentro dos componentes, para que a
 * camada de apresentação continue puramente presentacional e testável sem
 * mocks de rede.
 */
async function FunnelSection() {
  let snapshots
  try {
    snapshots = await getFunnelSnapshots()
  } catch (error) {
    return <DataError message={error instanceof Error ? error.message : String(error)} />
  }

  if (snapshots.length === 0) {
    return <DataError message="A fonte respondeu, mas não há nenhuma linha de funil no período." />
  }

  const totals = sumFunnelStages(snapshots)
  const stages = buildStageData(totals)
  const channels = listChannels(snapshots)

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        {stages.map((stage, index) => (
          <KpiCard
            key={stage.stage}
            label={stage.label}
            value={stage.value}
            conversion={
              stage.conversionFromPrevious === null
                ? null
                : {
                    from: FUNNEL_STAGE_LABELS[stages[index - 1].stage],
                    ratio: stage.conversionFromPrevious,
                  }
            }
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle hint="Total acumulado no período, por etapa">Etapas do funil</CardTitle>
          <FunnelStagesChart stages={stages} />
        </Card>

        <Card>
          <CardTitle hint="MQLs por mês, por canal de origem">Evolução por canal</CardTitle>
          <ChannelTrendChart trend={buildTrendData(snapshots)} channels={channels} />
        </Card>
      </div>

      <Card>
        <CardTitle hint="Números do período por canal">Detalhamento por canal</CardTitle>
        <ChannelTable rows={buildChannelRows(snapshots)} channels={channels} />
      </Card>
    </>
  )
}

function FunnelSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="bg-surface ring-hairline h-28 rounded-xl ring-1" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-surface ring-hairline h-80 rounded-xl ring-1" />
        <div className="bg-surface ring-hairline h-80 rounded-xl ring-1" />
      </div>
    </div>
  )
}
