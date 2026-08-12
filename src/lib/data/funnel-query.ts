import { FUNNEL_STAGES, type FunnelQuery, type FunnelSnapshot, type FunnelTotals } from './types'

/**
 * Aplica os filtros de `FunnelQuery` em memória.
 *
 * Compartilhado por todas as implementações de `FunnelRepository` que não
 * conseguem empurrar o filtro para a fonte — hoje, mock e Sheets. Uma futura
 * implementação em Postgres traduz o mesmo `FunnelQuery` para `WHERE` e não
 * usa esta função.
 *
 * A comparação de datas é lexicográfica, o que é correto e barato porque o
 * formato ISO `YYYY-MM-DD` ordena igual à data que representa.
 */
export function applyFunnelQuery(
  snapshots: readonly FunnelSnapshot[],
  query: FunnelQuery = {},
): FunnelSnapshot[] {
  const channels = query.channels?.length ? new Set(query.channels) : undefined

  return snapshots
    .filter((snapshot) => {
      if (query.from && snapshot.date < query.from) return false
      if (query.to && snapshot.date > query.to) return false
      if (channels && !channels.has(snapshot.channel)) return false
      return true
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.channel.localeCompare(b.channel))
}

/** Soma cada etapa do funil ao longo de todos os snapshots. */
export function sumFunnelStages(snapshots: readonly FunnelSnapshot[]): FunnelTotals {
  return snapshots.reduce<FunnelTotals>(
    (totals, snapshot) => {
      for (const stage of FUNNEL_STAGES) {
        totals[stage] += snapshot[stage]
      }
      return totals
    },
    { mqls: 0, opportunities: 0, customers: 0 },
  )
}

/** Lista os canais distintos presentes nos snapshots, em ordem alfabética. */
export function listChannels(snapshots: readonly FunnelSnapshot[]): string[] {
  return [...new Set(snapshots.map((snapshot) => snapshot.channel))].sort()
}
