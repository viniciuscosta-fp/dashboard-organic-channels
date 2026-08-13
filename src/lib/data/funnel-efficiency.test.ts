import { describe, expect, it } from 'vitest'

import { BASE_MINIMA_CONVERSAO, computeConversionMatrix, ratioOf } from './funnel-efficiency'
import { computeTiming } from './goal-math'
import type { FunnelSnapshot, FunnelTotals, Metric, MonthlyGoal } from './types'

/** Agosto de 2026 tem 21 dias úteis; julho, 23. */
const AGOSTO = { from: '2026-08-01', to: '2026-08-31' }
const JULHO_E_AGOSTO = { from: '2026-07-01', to: '2026-08-31' }

function snapshot(
  date: string,
  channel: string,
  values: Partial<FunnelTotals> = {},
): FunnelSnapshot {
  return {
    date,
    channel,
    revenue: values.revenue ?? 0,
    mqls: values.mqls ?? 0,
    opportunities: values.opportunities ?? 0,
    customers: values.customers ?? 0,
  }
}

function goal(month: string, channel: string, metric: Metric, target: number): MonthlyGoal {
  return { month, channel, metric, target }
}

function totals(values: Partial<FunnelTotals>): FunnelTotals {
  return {
    revenue: values.revenue ?? 0,
    mqls: values.mqls ?? 0,
    opportunities: values.opportunities ?? 0,
    customers: values.customers ?? 0,
  }
}

describe('ratioOf', () => {
  it('calcula as três razões a partir dos totais', () => {
    const values = totals({ mqls: 400, opportunities: 100, customers: 25 })

    expect(ratioOf(values, 'mql-to-opportunity')).toBeCloseTo(0.25)
    expect(ratioOf(values, 'opportunity-to-customer')).toBeCloseTo(0.25)
    expect(ratioOf(values, 'mql-to-customer')).toBeCloseTo(0.0625)
  })

  it('devolve null quando o denominador é zero', () => {
    expect(ratioOf(totals({ mqls: 0, opportunities: 3 }), 'mql-to-opportunity')).toBeNull()
  })

  it('calcula MQL para cliente direto, e não como produto das etapas', () => {
    // Cliente fechado sem oportunidade registrada: o produto das duas etapas
    // seria indefinido, a divisão direta continua válida.
    const values = totals({ mqls: 200, opportunities: 0, customers: 6 })

    expect(ratioOf(values, 'opportunity-to-customer')).toBeNull()
    expect(ratioOf(values, 'mql-to-customer')).toBeCloseTo(0.03)
  })
})

describe('computeConversionMatrix — razões realizadas', () => {
  const timing = computeTiming(AGOSTO, '2026-08-31')

  it('consolida pela razão das somas, não pela média das razões dos canais', () => {
    const snapshots = [
      snapshot('2026-08-03', 'organic_site', { mqls: 335, customers: 87 }),
      snapshot('2026-08-03', 'brand', { mqls: 118, customers: 47 }),
    ]

    const { total, byChannel } = computeConversionMatrix({
      periodSnapshots: snapshots,
      goals: [],
      timing,
    })

    const porCanal = byChannel.map((entry) => entry.ratios['mql-to-customer'].actual!)
    const mediaSimples = (porCanal[0] + porCanal[1]) / 2

    // 134 / 453 = 29,6%. A média simples daria 32,9% e inverteria a leitura.
    expect(total.ratios['mql-to-customer'].actual).toBeCloseTo(134 / 453, 6)
    expect(mediaSimples).toBeCloseTo(0.329, 3)
    expect(total.ratios['mql-to-customer'].actual).not.toBeCloseTo(mediaSimples, 3)
  })

  it('publica o denominador como base da razão', () => {
    const { total } = computeConversionMatrix({
      periodSnapshots: [snapshot('2026-08-03', 'brand', { mqls: 112, opportunities: 27 })],
      goals: [],
      timing,
    })

    expect(total.ratios['mql-to-opportunity'].base).toBe(112)
  })

  it('marca base fina abaixo do mínimo e não a marca na fronteira exata', () => {
    const abaixo = computeConversionMatrix({
      periodSnapshots: [
        snapshot('2026-08-03', 'brand', { mqls: BASE_MINIMA_CONVERSAO - 1, opportunities: 8 }),
      ],
      goals: [],
      timing,
    })
    const naFronteira = computeConversionMatrix({
      periodSnapshots: [
        snapshot('2026-08-03', 'brand', { mqls: BASE_MINIMA_CONVERSAO, opportunities: 8 }),
      ],
      goals: [],
      timing,
    })

    expect(abaixo.total.ratios['mql-to-opportunity'].thin).toBe(true)
    expect(naFronteira.total.ratios['mql-to-opportunity'].thin).toBe(false)
  })

  it('não marca base fina quando não há razão nenhuma', () => {
    const { total } = computeConversionMatrix({
      periodSnapshots: [snapshot('2026-08-03', 'brand', { mqls: 0, opportunities: 0 })],
      goals: [],
      timing,
    })

    expect(total.ratios['mql-to-opportunity'].actual).toBeNull()
    expect(total.ratios['mql-to-opportunity'].thin).toBe(false)
  })

  it('inclui canal com meta e sem nenhum resultado no período', () => {
    const { byChannel } = computeConversionMatrix({
      periodSnapshots: [snapshot('2026-08-03', 'brand', { mqls: 100, opportunities: 30 })],
      goals: [goal('2026-08', 'ai_referrals', 'mqls', 120)],
      timing,
    })

    expect(byChannel.map((entry) => entry.channel)).toEqual(['ai_referrals', 'brand'])
    expect(byChannel[0].ratios['mql-to-opportunity'].actual).toBeNull()
  })
})

describe('computeConversionMatrix — conversão implícita na meta', () => {
  const parDeMetas = (channel: string, month: string, mqls: number, opportunities: number) => [
    goal(month, channel, 'mqls', mqls),
    goal(month, channel, 'opportunities', opportunities),
  ]

  it('calcula o benchmark a partir do par de metas rateado', () => {
    const { total } = computeConversionMatrix({
      periodSnapshots: [snapshot('2026-08-03', 'brand', { mqls: 100, opportunities: 24 })],
      goals: parDeMetas('brand', '2026-08', 200, 60),
      timing: computeTiming(AGOSTO, '2026-08-31'),
    })

    const comparison = total.ratios['mql-to-opportunity']

    expect(comparison.benchmark).toBeCloseTo(0.3)
    expect(comparison.benchmarkGap).toBeNull()
    expect(comparison.delta).toBeCloseTo(0.24 - 0.3)
  })

  it('num período de um mês só, ratear até a data dá o mesmo que ratear o mês inteiro', () => {
    const goals = parDeMetas('brand', '2026-08', 200, 60)
    const snapshots = [snapshot('2026-08-03', 'brand', { mqls: 40, opportunities: 10 })]

    const meioDoMes = computeConversionMatrix({
      periodSnapshots: snapshots,
      goals,
      timing: computeTiming(AGOSTO, '2026-08-14'),
    })
    const mesFechado = computeConversionMatrix({
      periodSnapshots: snapshots,
      goals,
      timing: computeTiming(AGOSTO, '2026-08-31'),
    })

    expect(meioDoMes.total.ratios['mql-to-opportunity'].benchmark).toBeCloseTo(
      mesFechado.total.ratios['mql-to-opportunity'].benchmark!,
      10,
    )
  })

  it('num período de dois meses com razões diferentes, usa a janela até a data', () => {
    const goals = [
      ...parDeMetas('brand', '2026-07', 100, 20),
      ...parDeMetas('brand', '2026-08', 100, 40),
    ]

    const soJulho = computeConversionMatrix({
      periodSnapshots: [snapshot('2026-07-15', 'brand', { mqls: 50, opportunities: 12 })],
      goals,
      timing: computeTiming(JULHO_E_AGOSTO, '2026-07-31'),
    })

    // Julho pressupõe 20%; os dois meses juntos, 30%. A janela até a data cobre
    // só julho, então o benchmark tem de ser 20%.
    expect(soJulho.total.ratios['mql-to-opportunity'].benchmark).toBeCloseTo(0.2, 10)
  })

  it('sem nenhum dado no período, publica o benchmark do período inteiro e não publica delta', () => {
    const { total } = computeConversionMatrix({
      periodSnapshots: [],
      goals: [
        ...parDeMetas('brand', '2026-07', 100, 20),
        ...parDeMetas('brand', '2026-08', 100, 40),
      ],
      channels: ['brand'],
      timing: computeTiming(JULHO_E_AGOSTO, null),
    })

    const comparison = total.ratios['mql-to-opportunity']

    expect(comparison.benchmark).toBeCloseTo(0.3, 10)
    expect(comparison.actual).toBeNull()
    expect(comparison.delta).toBeNull()
  })

  it('trata meta zero explícita como benchmark zero, não como meta ausente', () => {
    const { total } = computeConversionMatrix({
      periodSnapshots: [snapshot('2026-08-03', 'brand', { mqls: 100, opportunities: 5 })],
      goals: parDeMetas('brand', '2026-08', 200, 0),
      timing: computeTiming(AGOSTO, '2026-08-31'),
    })

    const comparison = total.ratios['mql-to-opportunity']

    expect(comparison.benchmark).toBe(0)
    expect(comparison.benchmarkGap).toBeNull()
    expect(comparison.delta).toBeCloseTo(0.05)
  })

  it('recusa o benchmark quando nenhum mês tem meta do numerador', () => {
    const { total } = computeConversionMatrix({
      periodSnapshots: [snapshot('2026-08-03', 'brand', { mqls: 100, opportunities: 24 })],
      goals: [goal('2026-08', 'brand', 'mqls', 200)],
      timing: computeTiming(AGOSTO, '2026-08-31'),
    })

    expect(total.ratios['mql-to-opportunity'].benchmark).toBeNull()
    expect(total.ratios['mql-to-opportunity'].benchmarkGap).toBe('sem-meta-numerador')
  })

  it('recusa o benchmark quando nenhum mês tem meta do denominador', () => {
    const { total } = computeConversionMatrix({
      periodSnapshots: [snapshot('2026-08-03', 'brand', { mqls: 100, opportunities: 24 })],
      goals: [goal('2026-08', 'brand', 'opportunities', 60)],
      timing: computeTiming(AGOSTO, '2026-08-31'),
    })

    expect(total.ratios['mql-to-opportunity'].benchmark).toBeNull()
    expect(total.ratios['mql-to-opportunity'].benchmarkGap).toBe('sem-meta-denominador')
  })

  it('recusa o benchmark quando as duas métricas têm meta em meses diferentes', () => {
    const { total } = computeConversionMatrix({
      periodSnapshots: [snapshot('2026-07-15', 'brand', { mqls: 100, opportunities: 24 })],
      goals: [
        goal('2026-07', 'brand', 'mqls', 100),
        goal('2026-07', 'brand', 'opportunities', 20),
        goal('2026-08', 'brand', 'opportunities', 40),
      ],
      channels: ['brand'],
      timing: computeTiming(JULHO_E_AGOSTO, '2026-08-31'),
    })

    expect(total.ratios['mql-to-opportunity'].benchmark).toBeNull()
    expect(total.ratios['mql-to-opportunity'].benchmarkGap).toBe('meses-incompativeis')
  })

  it('recusa o benchmark consolidado quando parte dos canais não tem o par de metas', () => {
    const { total, byChannel } = computeConversionMatrix({
      periodSnapshots: [
        snapshot('2026-08-03', 'brand', { mqls: 100, opportunities: 30 }),
        snapshot('2026-08-03', 'compare', { mqls: 80, opportunities: 16 }),
      ],
      goals: parDeMetas('brand', '2026-08', 200, 60),
      channels: ['brand', 'compare'],
      timing: computeTiming(AGOSTO, '2026-08-31'),
    })

    expect(total.ratios['mql-to-opportunity'].benchmark).toBeNull()
    expect(total.ratios['mql-to-opportunity'].benchmarkGap).toBe('cobertura-parcial-de-canais')
    expect(total.ratios['mql-to-opportunity'].excludedChannels).toEqual(['compare'])

    // O canal que tem o par continua com benchmark próprio.
    expect(byChannel[0].ratios['mql-to-opportunity'].benchmark).toBeCloseTo(0.3)
  })

  it('recusa o benchmark consolidado quando o numerador cobre mais canais que o denominador', () => {
    // A armadilha: `prorateGoal` só marca um mês como faltante quando nenhum
    // canal tem meta nele. Somando de uma vez, o benchmark sairia de um
    // numerador com quatro canais sobre um denominador com três.
    const canais = ['a', 'b', 'c', 'd']

    const { total } = computeConversionMatrix({
      periodSnapshots: canais.map((channel) =>
        snapshot('2026-08-03', channel, { mqls: 100, opportunities: 25 }),
      ),
      goals: [
        ...canais.map((channel) => goal('2026-08', channel, 'opportunities', 30)),
        ...canais.slice(0, 3).map((channel) => goal('2026-08', channel, 'mqls', 100)),
      ],
      channels: canais,
      timing: computeTiming(AGOSTO, '2026-08-31'),
    })

    expect(total.ratios['mql-to-opportunity'].benchmark).toBeNull()
    expect(total.ratios['mql-to-opportunity'].benchmarkGap).toBe('cobertura-parcial-de-canais')
    expect(total.ratios['mql-to-opportunity'].excludedChannels).toEqual(['d'])
  })
})
