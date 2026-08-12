import { describe, expect, it } from 'vitest'

import { applyFunnelQuery, listChannels, sumFunnelStages } from './funnel-query'
import type { FunnelSnapshot } from './types'

const snapshots: FunnelSnapshot[] = [
  { date: '2026-02-01', channel: 'direct', mqls: 10, opportunities: 4, customers: 1 },
  { date: '2026-01-01', channel: 'organic-search', mqls: 20, opportunities: 6, customers: 2 },
  { date: '2026-01-01', channel: 'direct', mqls: 5, opportunities: 2, customers: 0 },
  { date: '2026-03-01', channel: 'referral', mqls: 7, opportunities: 3, customers: 1 },
]

describe('applyFunnelQuery', () => {
  it('ordena por data e depois por canal', () => {
    const result = applyFunnelQuery(snapshots)

    expect(result.map((s) => [s.date, s.channel])).toEqual([
      ['2026-01-01', 'direct'],
      ['2026-01-01', 'organic-search'],
      ['2026-02-01', 'direct'],
      ['2026-03-01', 'referral'],
    ])
  })

  it('trata from e to como inclusivos', () => {
    const result = applyFunnelQuery(snapshots, { from: '2026-01-01', to: '2026-02-01' })

    expect(result).toHaveLength(3)
    expect(result.every((s) => s.date <= '2026-02-01')).toBe(true)
  })

  it('filtra por canal', () => {
    const result = applyFunnelQuery(snapshots, { channels: ['direct'] })

    expect(result.map((s) => s.channel)).toEqual(['direct', 'direct'])
  })

  it('ignora lista de canais vazia em vez de zerar o resultado', () => {
    expect(applyFunnelQuery(snapshots, { channels: [] })).toHaveLength(snapshots.length)
  })

  it('não muta o array de entrada', () => {
    const original = [...snapshots]
    applyFunnelQuery(snapshots, { from: '2026-02-01' })

    expect(snapshots).toEqual(original)
  })
})

describe('sumFunnelStages', () => {
  it('soma cada etapa', () => {
    expect(sumFunnelStages(snapshots)).toEqual({
      mqls: 42,
      opportunities: 15,
      customers: 4,
    })
  })

  it('devolve zeros para lista vazia', () => {
    expect(sumFunnelStages([])).toEqual({ mqls: 0, opportunities: 0, customers: 0 })
  })
})

describe('listChannels', () => {
  it('devolve canais únicos em ordem alfabética', () => {
    expect(listChannels(snapshots)).toEqual(['direct', 'organic-search', 'referral'])
  })
})
