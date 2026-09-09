import { describe, expect, it } from 'vitest'

import { listBusinessDays } from '../business-days'
import { computeTiming, firstDataDate } from './goal-math'
import { computePeriodComparison, findMetricComparison } from './period-comparison'
import type { FunnelSnapshot, FunnelTotals } from './types'

/** Agosto de 2026 tem 21 dias úteis e começa num sábado. */
const AGOSTO = { from: '2026-08-01', to: '2026-08-31' }

function daily(
  from: string,
  to: string,
  channel: string,
  perDay: Partial<FunnelTotals> = {},
): FunnelSnapshot[] {
  return listBusinessDays(from, to).map((date) => ({
    date,
    channel,
    revenue: perDay.revenue ?? 0,
    mqls: perDay.mqls ?? 0,
    opportunities: perDay.opportunities ?? 0,
    customers: perDay.customers ?? 0,
  }))
}

function customers(comparison: ReturnType<typeof computePeriodComparison>) {
  return findMetricComparison(comparison, 'total', 'customers')!
}

describe('computePeriodComparison', () => {
  it('compara a janela realizada, não o recorte inteiro', () => {
    // Dez dias úteis decorridos num mês de 21. Sem esta regra, os 10 dias
    // realizados seriam comparados contra 21 dias anteriores e o canal
    // apareceria despencando pela metade.
    const snapshots = [
      ...daily('2026-07-01', '2026-07-31', 'organic', { customers: 2 }),
      ...daily('2026-08-01', '2026-08-14', 'organic', { customers: 2 }),
    ]

    const comparison = computePeriodComparison({
      snapshots,
      timing: computeTiming(AGOSTO, '2026-08-14'),
      firstDataDate: firstDataDate(snapshots),
    })

    expect(comparison.businessDays).toBe(10)
    expect(comparison.previousRange).toEqual({ from: '2026-07-20', to: '2026-07-31' })
    expect(customers(comparison).current).toBe(20)
    expect(customers(comparison).previous).toBe(20)
    expect(customers(comparison).delta).toBe(0)
  })

  it('a janela atual termina na última data com dado', () => {
    const snapshots = [
      ...daily('2026-07-01', '2026-07-31', 'organic', { customers: 1 }),
      ...daily('2026-08-01', '2026-08-14', 'organic', { customers: 1 }),
    ]

    const comparison = computePeriodComparison({
      snapshots,
      timing: computeTiming(AGOSTO, '2026-08-14'),
      firstDataDate: firstDataDate(snapshots),
    })

    expect(comparison.currentRange).toEqual({ from: '2026-08-01', to: '2026-08-14' })
  })

  it('mede crescimento e queda com sinal e variação relativa', () => {
    const snapshots = [
      ...daily('2026-07-20', '2026-07-31', 'organic', { customers: 2 }),
      ...daily('2026-08-01', '2026-08-14', 'organic', { customers: 3 }),
    ]

    const comparison = computePeriodComparison({
      snapshots,
      timing: computeTiming(AGOSTO, '2026-08-14'),
      firstDataDate: firstDataDate(snapshots),
    })

    expect(customers(comparison).current).toBe(30)
    expect(customers(comparison).previous).toBe(20)
    expect(customers(comparison).delta).toBe(10)
    expect(customers(comparison).relative).toBeCloseTo(0.5)
  })

  it('recusa a comparação quando não há dado no período', () => {
    const comparison = computePeriodComparison({
      snapshots: daily('2026-07-01', '2026-07-31', 'organic', { customers: 1 }),
      timing: computeTiming(AGOSTO, null),
      firstDataDate: '2026-07-01',
    })

    expect(comparison.unavailable).toBe('sem-dado-no-periodo')
    expect(comparison.total).toBeNull()
  })

  it('recusa a comparação quando a janela anterior antecede o histórico da fonte', () => {
    // O histórico começa junto com o período: não há passado com que comparar,
    // e ler zeros ali fabricaria crescimento.
    const snapshots = daily('2026-08-01', '2026-08-14', 'organic', { customers: 3 })

    const comparison = computePeriodComparison({
      snapshots,
      timing: computeTiming(AGOSTO, '2026-08-14'),
      firstDataDate: firstDataDate(snapshots),
    })

    expect(comparison.unavailable).toBe('historico-insuficiente')
    expect(comparison.byChannel).toEqual([])
  })

  it('não inventa variação relativa quando a base anterior é zero', () => {
    const snapshots = [
      ...daily('2026-07-20', '2026-07-31', 'antigo', { customers: 1 }),
      ...daily('2026-08-01', '2026-08-14', 'antigo', { customers: 1 }),
      ...daily('2026-08-01', '2026-08-14', 'novo', { customers: 8 }),
    ]

    const comparison = computePeriodComparison({
      snapshots,
      timing: computeTiming(AGOSTO, '2026-08-14'),
      firstDataDate: firstDataDate(snapshots),
    })

    const novo = findMetricComparison(comparison, 'novo', 'customers')!

    expect(novo.delta).toBe(80)
    expect(novo.relative).toBeNull()
  })

  it('mostra como queda o canal que existia antes e parou', () => {
    const snapshots = [
      ...daily('2026-07-20', '2026-07-31', 'parado', { customers: 2 }),
      ...daily('2026-08-01', '2026-08-14', 'ativo', { customers: 2 }),
    ]

    const comparison = computePeriodComparison({
      snapshots,
      timing: computeTiming(AGOSTO, '2026-08-14'),
      firstDataDate: firstDataDate(snapshots),
    })

    const parado = findMetricComparison(comparison, 'parado', 'customers')!

    expect(comparison.byChannel.map((entry) => entry.channel)).toEqual(['ativo', 'parado'])
    expect(parado.current).toBe(0)
    expect(parado.previous).toBe(20)
    expect(parado.delta).toBe(-20)
    expect(parado.relative).toBeCloseTo(-1)
  })

  it('o consolidado soma os canais', () => {
    const snapshots = [
      ...daily('2026-07-20', '2026-07-31', 'a', { customers: 1 }),
      ...daily('2026-07-20', '2026-07-31', 'b', { customers: 3 }),
      ...daily('2026-08-01', '2026-08-14', 'a', { customers: 2 }),
      ...daily('2026-08-01', '2026-08-14', 'b', { customers: 4 }),
    ]

    const comparison = computePeriodComparison({
      snapshots,
      timing: computeTiming(AGOSTO, '2026-08-14'),
      firstDataDate: firstDataDate(snapshots),
    })

    expect(customers(comparison).current).toBe(60)
    expect(customers(comparison).previous).toBe(40)
  })

  it('compara as quatro métricas', () => {
    const snapshots = [
      ...daily('2026-07-20', '2026-07-31', 'organic', {
        revenue: 100,
        mqls: 10,
        opportunities: 4,
        customers: 1,
      }),
      ...daily('2026-08-01', '2026-08-14', 'organic', {
        revenue: 150,
        mqls: 12,
        opportunities: 5,
        customers: 2,
      }),
    ]

    const comparison = computePeriodComparison({
      snapshots,
      timing: computeTiming(AGOSTO, '2026-08-14'),
      firstDataDate: firstDataDate(snapshots),
    })

    expect(comparison.total!.metrics.map((entry) => entry.metric)).toEqual([
      'revenue',
      'mqls',
      'opportunities',
      'customers',
    ])
    expect(comparison.total!.metrics.every((entry) => entry.delta > 0)).toBe(true)
  })
})

describe('findMetricComparison', () => {
  it('devolve null quando a comparação não está disponível', () => {
    const indisponivel = computePeriodComparison({
      snapshots: [],
      timing: computeTiming(AGOSTO, null),
      firstDataDate: null,
    })

    expect(findMetricComparison(indisponivel, 'total', 'customers')).toBeNull()
    expect(findMetricComparison(null, 'total', 'customers')).toBeNull()
  })

  it('devolve null para canal que não está na comparação', () => {
    const snapshots = [
      ...daily('2026-07-20', '2026-07-31', 'organic', { customers: 1 }),
      ...daily('2026-08-01', '2026-08-14', 'organic', { customers: 1 }),
    ]

    const comparison = computePeriodComparison({
      snapshots,
      timing: computeTiming(AGOSTO, '2026-08-14'),
      firstDataDate: firstDataDate(snapshots),
    })

    expect(findMetricComparison(comparison, 'inexistente', 'customers')).toBeNull()
  })
})
