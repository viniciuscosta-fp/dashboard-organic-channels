import { describe, expect, it } from 'vitest'

import {
  buildConversionWeeks,
  buildStageData,
  buildTrendData,
  conversionWeekDeltas,
  MAX_SEMANAS_EXIBIDAS,
  sortByUrgency,
  summarizeChannelStatus,
  trendGranularity,
  worstStatus,
} from './funnel-view'
import type { ChannelAdherence, GoalStatus, MetricAdherence } from './goal-math'
import { METRICS, type FunnelSnapshot, type FunnelTotals } from './types'

/** Aderência mínima de um canal: só o status de cada métrica importa aqui. */
function adherence(channel: string, statuses: GoalStatus[]): ChannelAdherence {
  return {
    channel,
    metrics: statuses.map(
      (status, index) => ({ metric: METRICS[index], status }) as MetricAdherence,
    ),
  }
}

describe('worstStatus', () => {
  it('devolve o status mais urgente entre as métricas', () => {
    expect(worstStatus(adherence('a', ['no-ritmo', 'atencao', 'risco']).metrics)).toBe('risco')
    expect(worstStatus(adherence('a', ['no-ritmo', 'atencao']).metrics)).toBe('atencao')
  })

  it('ignora métrica sem meta quando outra tem régua', () => {
    expect(worstStatus(adherence('a', ['sem-meta', 'no-ritmo']).metrics)).toBe('no-ritmo')
  })

  it('só é sem meta quando nenhuma métrica tem meta', () => {
    expect(worstStatus(adherence('a', ['sem-meta', 'sem-meta']).metrics)).toBe('sem-meta')
    expect(worstStatus([])).toBe('sem-meta')
  })
})

describe('sortByUrgency', () => {
  const order = ['c1', 'c2', 'c3', 'c4', 'c5']

  it('põe risco antes de atenção, antes de no ritmo, antes de sem meta', () => {
    const sorted = sortByUrgency(
      [
        adherence('c1', ['sem-meta']),
        adherence('c2', ['no-ritmo']),
        adherence('c3', ['no-ritmo', 'risco']),
        adherence('c4', ['atencao']),
      ],
      order,
    )

    expect(sorted.map((entry) => entry.channel)).toEqual(['c3', 'c4', 'c2', 'c1'])
  })

  it('desempata pela ordem canônica, não pela ordem de entrada', () => {
    const sorted = sortByUrgency(
      [adherence('c5', ['risco']), adherence('c2', ['risco']), adherence('c4', ['risco'])],
      order,
    )

    expect(sorted.map((entry) => entry.channel)).toEqual(['c2', 'c4', 'c5'])
  })

  it('põe canal fora da ordem depois dos conhecidos do mesmo status', () => {
    const sorted = sortByUrgency([adherence('fora', ['risco']), adherence('c3', ['risco'])], order)

    expect(sorted.map((entry) => entry.channel)).toEqual(['c3', 'fora'])
  })

  it('não altera a lista recebida', () => {
    const input = [adherence('c2', ['no-ritmo']), adherence('c1', ['risco'])]

    sortByUrgency(input, order)

    expect(input.map((entry) => entry.channel)).toEqual(['c2', 'c1'])
  })
})

describe('summarizeChannelStatus', () => {
  const order = ['c1', 'c2', 'c3']

  it('põe cada canal uma vez só, no seu pior status, com as métricas que o puseram ali', () => {
    const summary = summarizeChannelStatus(
      [
        adherence('c1', ['risco', 'atencao', 'risco']),
        adherence('c2', ['no-ritmo', 'atencao']),
        adherence('c3', ['sem-meta', 'sem-meta']),
      ],
      order,
    )

    expect(summary).toEqual([
      { status: 'risco', channels: [{ channel: 'c1', metrics: ['revenue', 'opportunities'] }] },
      { status: 'atencao', channels: [{ channel: 'c2', metrics: ['mqls'] }] },
      { status: 'no-ritmo', channels: [] },
      { status: 'sem-meta', channels: [{ channel: 'c3', metrics: [] }] },
    ])
  })

  it('devolve os quatro status mesmo sem nenhum canal', () => {
    expect(summarizeChannelStatus([], order).map((group) => group.channels.length)).toEqual([
      0, 0, 0, 0,
    ])
  })
})

function totals(values: Partial<FunnelTotals>): FunnelTotals {
  return {
    revenue: values.revenue ?? 0,
    mqls: values.mqls ?? 0,
    opportunities: values.opportunities ?? 0,
    customers: values.customers ?? 0,
  }
}

function snapshot(date: string, channel: string, mqls: number): FunnelSnapshot {
  return { date, channel, revenue: 0, mqls, opportunities: 0, customers: 0 }
}

describe('buildStageData', () => {
  it('devolve só as três etapas, na ordem do funil', () => {
    const stages = buildStageData(totals({ revenue: 50_000, mqls: 400, opportunities: 100 }))

    expect(stages.map((stage) => stage.stage)).toEqual(['mqls', 'opportunities', 'customers'])
  })

  it('mantém a receita fora do funil', () => {
    const stages = buildStageData(totals({ revenue: 50_000, mqls: 400 }))

    expect(stages.some((stage) => (stage.stage as string) === 'revenue')).toBe(false)
  })

  it('calcula a conversão em relação à etapa vizinha anterior', () => {
    const stages = buildStageData(totals({ mqls: 400, opportunities: 100, customers: 25 }))

    expect(stages[1].conversionFromPrevious).toBeCloseTo(0.25)
    expect(stages[2].conversionFromPrevious).toBeCloseTo(0.25)
  })

  it('não calcula conversão na primeira etapa', () => {
    const stages = buildStageData(totals({ mqls: 400, opportunities: 100 }))

    expect(stages[0].conversionFromPrevious).toBeNull()
  })

  it('devolve null quando a etapa anterior é zero, em vez de dividir por zero', () => {
    const stages = buildStageData(totals({ mqls: 0, opportunities: 0, customers: 3 }))

    expect(stages[1].conversionFromPrevious).toBeNull()
    expect(stages[2].conversionFromPrevious).toBeNull()
  })

  it('distingue conversão zero de conversão inexistente', () => {
    const stages = buildStageData(totals({ mqls: 400, opportunities: 0 }))

    expect(stages[1].conversionFromPrevious).toBe(0)
    expect(stages[2].conversionFromPrevious).toBeNull()
  })
})

describe('trendGranularity', () => {
  it('agrupa por dia até 45 dias', () => {
    expect(trendGranularity({ from: '2026-08-01', to: '2026-09-14' })).toBe('diaria')
  })

  it('passa a semanal a partir de 46 dias', () => {
    expect(trendGranularity({ from: '2026-08-01', to: '2026-09-15' })).toBe('semanal')
  })

  it('mantém semanal até 180 dias', () => {
    expect(trendGranularity({ from: '2026-01-01', to: '2026-06-29' })).toBe('semanal')
  })

  it('passa a mensal a partir de 181 dias', () => {
    expect(trendGranularity({ from: '2026-01-01', to: '2026-06-30' })).toBe('mensal')
  })

  it('agrupa por dia um período de um dia só', () => {
    expect(trendGranularity({ from: '2026-08-03', to: '2026-08-03' })).toBe('diaria')
  })
})

describe('buildTrendData', () => {
  it('agrupa por semana começando na segunda-feira', () => {
    const trend = buildTrendData(
      [
        // Quarta e sexta da mesma semana, mais a segunda da seguinte.
        snapshot('2026-08-05', 'brand', 4),
        snapshot('2026-08-07', 'brand', 6),
        snapshot('2026-08-10', 'brand', 3),
      ],
      'semanal',
    )

    expect(trend.map((point) => point.date)).toEqual(['2026-08-03', '2026-08-10'])
    expect(trend.map((point) => point.channels.brand)).toEqual([10, 3])
  })

  it('agrupa por mês e rotula com mês abreviado', () => {
    const trend = buildTrendData(
      [snapshot('2026-07-15', 'brand', 5), snapshot('2026-08-03', 'brand', 8)],
      'mensal',
    )

    expect(trend.map((point) => point.date)).toEqual(['2026-07-01', '2026-08-01'])
    expect(trend.map((point) => point.label)).toEqual(['jul/26', 'ago/26'])
  })

  it('preenche com zero o canal sem dado no intervalo', () => {
    const trend = buildTrendData(
      [snapshot('2026-07-15', 'brand', 5), snapshot('2026-08-03', 'compare', 8)],
      'mensal',
    )

    expect(trend[0].channels).toEqual({ brand: 5, compare: 0 })
    expect(trend[1].channels).toEqual({ brand: 0, compare: 8 })
  })

  it('ordena os intervalos por data', () => {
    const trend = buildTrendData(
      [snapshot('2026-08-03', 'brand', 8), snapshot('2026-07-15', 'brand', 5)],
      'mensal',
    )

    expect(trend.map((point) => point.date)).toEqual(['2026-07-01', '2026-08-01'])
  })

  it('devolve lista vazia sem snapshots', () => {
    expect(buildTrendData([], 'semanal')).toEqual([])
  })
})

describe('buildConversionWeeks', () => {
  /** Agosto de 2026 começa num sábado; as segundas são 3, 10, 17, 24 e 31. */
  const AGOSTO = { from: '2026-08-01', to: '2026-08-31' }

  function funil(date: string, channel: string, values: Partial<FunnelTotals>): FunnelSnapshot {
    return {
      date,
      channel,
      revenue: values.revenue ?? 0,
      mqls: values.mqls ?? 0,
      opportunities: values.opportunities ?? 0,
      customers: values.customers ?? 0,
    }
  }

  it('abre cada semana na segunda-feira', () => {
    const weeks = buildConversionWeeks([], 'mql-to-opportunity', AGOSTO, '2026-08-14', ['brand'])

    // A semana que contém 1º de agosto começa em 27 de julho.
    expect(weeks.map((week) => week.date)).toEqual(['2026-07-27', '2026-08-03', '2026-08-10'])
    expect(weeks[0].label).toBe('27/07')
  })

  it('completa a primeira semana com dias anteriores ao período', () => {
    const weeks = buildConversionWeeks(
      [
        // Terça, 28 de julho: fora do período, dentro da primeira semana.
        funil('2026-07-28', 'brand', { mqls: 40, opportunities: 12 }),
        funil('2026-08-03', 'brand', { mqls: 60, opportunities: 12 }),
      ],
      'mql-to-opportunity',
      AGOSTO,
      '2026-08-07',
      ['brand'],
    )

    expect(weeks[0].bases.brand).toBe(40)
    expect(weeks[0].channels.brand).toBeCloseTo(0.3)
    expect(weeks[1].bases.brand).toBe(60)
  })

  it('devolve null quando não houve denominador na semana', () => {
    const weeks = buildConversionWeeks(
      [funil('2026-08-03', 'brand', { mqls: 0, opportunities: 0 })],
      'mql-to-opportunity',
      AGOSTO,
      '2026-08-07',
      ['brand'],
    )

    expect(weeks[1].channels.brand).toBeNull()
    expect(weeks[1].bases.brand).toBe(0)
  })

  it('devolve zero quando houve denominador e nada converteu', () => {
    const weeks = buildConversionWeeks(
      [funil('2026-08-03', 'brand', { mqls: 20, opportunities: 0 })],
      'mql-to-opportunity',
      AGOSTO,
      '2026-08-07',
      ['brand'],
    )

    expect(weeks[1].channels.brand).toBe(0)
  })

  it('consolida a semana pela razão das somas, não pela média dos canais', () => {
    const weeks = buildConversionWeeks(
      [
        funil('2026-08-03', 'brand', { mqls: 300, opportunities: 90 }),
        funil('2026-08-04', 'compare', { mqls: 100, opportunities: 10 }),
      ],
      'mql-to-opportunity',
      AGOSTO,
      '2026-08-07',
      ['brand', 'compare'],
    )

    // 100 / 400 = 25%. A média simples das razões daria 20%.
    expect(weeks[1].total).toBeCloseTo(0.25)
    expect(weeks[1].totalBase).toBe(400)
  })

  it('marca como parcial a semana que passa do último dado', () => {
    const weeks = buildConversionWeeks([], 'mql-to-opportunity', AGOSTO, '2026-08-12', ['brand'])

    // A semana de 10/08 vai até 16/08 e o dado para em 12/08.
    expect(weeks.map((week) => week.partial)).toEqual([false, false, true])
  })

  it('não marca parcial a semana que fecha exatamente no último dado', () => {
    const weeks = buildConversionWeeks([], 'mql-to-opportunity', AGOSTO, '2026-08-09', ['brand'])

    expect(weeks.map((week) => week.date)).toEqual(['2026-07-27', '2026-08-03'])
    expect(weeks.every((week) => week.partial)).toBe(false)
  })

  it('ignora semana posterior ao último dado, mesmo com o período aberto até o fim do mês', () => {
    const weeks = buildConversionWeeks([], 'mql-to-opportunity', AGOSTO, '2026-08-07', ['brand'])

    expect(weeks.at(-1)!.date).toBe('2026-08-03')
  })

  it('mantém as semanas mais recentes ao cortar no limite', () => {
    const weeks = buildConversionWeeks(
      [],
      'mql-to-opportunity',
      { from: '2026-06-01', to: '2026-08-31' },
      '2026-08-31',
      ['brand'],
    )

    // 1º de junho de 2026 é uma segunda; de lá até 31 de agosto são 14 semanas.
    expect(weeks).toHaveLength(MAX_SEMANAS_EXIBIDAS)
    expect(weeks.at(-1)!.date).toBe('2026-08-31')
    expect(weeks[0].date).toBe('2026-07-13')
  })

  it('respeita um limite explícito', () => {
    const weeks = buildConversionWeeks(
      [],
      'mql-to-opportunity',
      { from: '2026-06-01', to: '2026-08-31' },
      '2026-08-31',
      ['brand'],
      3,
    )

    expect(weeks).toHaveLength(3)
    expect(weeks.at(-1)!.date).toBe('2026-08-31')
  })

  it('devolve lista vazia quando não há dado no período', () => {
    expect(buildConversionWeeks([], 'mql-to-opportunity', AGOSTO, null, ['brand'])).toEqual([])
  })

  it('devolve lista vazia quando o último dado é anterior ao período', () => {
    expect(buildConversionWeeks([], 'mql-to-opportunity', AGOSTO, '2026-07-15', ['brand'])).toEqual(
      [],
    )
  })

  it('ignora canal fora da lista informada', () => {
    const weeks = buildConversionWeeks(
      [
        funil('2026-08-03', 'brand', { mqls: 100, opportunities: 30 }),
        funil('2026-08-03', 'fora_do_catalogo', { mqls: 900, opportunities: 0 }),
      ],
      'mql-to-opportunity',
      AGOSTO,
      '2026-08-07',
      ['brand'],
    )

    expect(weeks[1].totalBase).toBe(100)
    expect(weeks[1].channels).toEqual({ brand: 0.3 })
  })

  it('mede a variação entre as duas últimas semanas exibidas', () => {
    const weeks = buildConversionWeeks(
      [
        funil('2026-08-03', 'brand', { mqls: 100, opportunities: 30 }),
        funil('2026-08-10', 'brand', { mqls: 100, opportunities: 24 }),
      ],
      'mql-to-opportunity',
      AGOSTO,
      '2026-08-16',
      ['brand'],
    )

    const delta = conversionWeekDeltas(weeks)

    expect(delta.previous).toBe('2026-08-03')
    expect(delta.current).toBe('2026-08-10')
    expect(delta.channels.brand).toBeCloseTo(-0.06)
    expect(delta.total).toBeCloseTo(-0.06)
    expect(delta.provisional).toBe(false)
  })

  it('marca a variação como provisória quando a última semana não fechou', () => {
    const weeks = buildConversionWeeks(
      [
        funil('2026-08-03', 'brand', { mqls: 100, opportunities: 30 }),
        funil('2026-08-10', 'brand', { mqls: 50, opportunities: 10 }),
      ],
      'mql-to-opportunity',
      AGOSTO,
      '2026-08-12',
      ['brand'],
    )

    expect(conversionWeekDeltas(weeks).provisional).toBe(true)
  })

  it('não calcula variação sem denominador em uma das semanas', () => {
    const weeks = buildConversionWeeks(
      [funil('2026-08-10', 'brand', { mqls: 100, opportunities: 24 })],
      'mql-to-opportunity',
      AGOSTO,
      '2026-08-16',
      ['brand'],
    )

    // A semana de 03/08 ficou sem MQL, então não há de onde variar.
    expect(conversionWeekDeltas(weeks).channels.brand).toBeNull()
  })

  it('não calcula variação com menos de duas semanas', () => {
    const weeks = buildConversionWeeks(
      [funil('2026-08-03', 'brand', { mqls: 100, opportunities: 24 })],
      'mql-to-opportunity',
      { from: '2026-08-03', to: '2026-08-09' },
      '2026-08-09',
      ['brand'],
    )
    const delta = conversionWeekDeltas(weeks)

    expect(weeks).toHaveLength(1)
    expect(delta.previous).toBeNull()
    expect(delta.total).toBeNull()
    expect(delta.channels).toEqual({})
  })

  it('não calcula variação sem semana nenhuma', () => {
    expect(conversionWeekDeltas([])).toEqual({
      current: null,
      previous: null,
      channels: {},
      total: null,
      provisional: false,
    })
  })

  it('usa o par de métricas da razão pedida', () => {
    const snapshots = [
      funil('2026-08-03', 'brand', { mqls: 200, opportunities: 50, customers: 10 }),
    ]

    const opp = buildConversionWeeks(snapshots, 'opportunity-to-customer', AGOSTO, '2026-08-07', [
      'brand',
    ])
    const cliente = buildConversionWeeks(snapshots, 'mql-to-customer', AGOSTO, '2026-08-07', [
      'brand',
    ])

    expect(opp[1].channels.brand).toBeCloseTo(0.2)
    expect(opp[1].bases.brand).toBe(50)
    expect(cliente[1].channels.brand).toBeCloseTo(0.05)
    expect(cliente[1].bases.brand).toBe(200)
  })
})
