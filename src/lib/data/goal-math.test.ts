import { describe, expect, it } from 'vitest'

import { listBusinessDays } from '../business-days'
import {
  classifyStatus,
  computeAdherence,
  computeTiming,
  indexGoals,
  JANELA_TENDENCIA_DIAS_UTEIS,
  lastDataDate,
  prorateGoal,
  recentDailyRate,
  type ChannelAdherence,
  type MetricAdherence,
} from './goal-math'
import type { FunnelSnapshot, FunnelTotals, MonthlyGoal } from './types'

/**
 * Agosto de 2026 tem 21 dias úteis e começa num sábado, o que faz dele um bom
 * mês de teste: os cinco primeiros dias úteis caem de 3 a 7, e os dez primeiros
 * terminam no dia 14.
 */
const AGOSTO = { from: '2026-08-01', to: '2026-08-31' }

/** Gera uma linha por **dia útil**; fim de semana fica sem linha de propósito. */
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

function goal(month: string, channel: string, target: number): MonthlyGoal {
  return { month, channel, metric: 'customers', target }
}

describe('computeTiming', () => {
  it('mede o decorrido contra a última data com dado', () => {
    const timing = computeTiming(AGOSTO, '2026-08-14')

    expect(timing.businessDaysTotal).toBe(21)
    expect(timing.businessDaysElapsed).toBe(10)
    expect(timing.businessDaysRemaining).toBe(11)
    expect(timing.elapsedRatio).toBeCloseTo(10 / 21)
  })

  it('trata ausência de dado como nada decorrido', () => {
    const timing = computeTiming(AGOSTO, null)

    expect(timing.businessDaysElapsed).toBe(0)
    expect(timing.businessDaysRemaining).toBe(21)
    expect(timing.trendWindow).toEqual([])
  })

  it('não deixa o decorrido passar do fim do período', () => {
    const timing = computeTiming(AGOSTO, '2026-09-20')

    expect(timing.businessDaysElapsed).toBe(21)
    expect(timing.businessDaysRemaining).toBe(0)
  })

  it('ignora dado anterior ao início do período', () => {
    expect(computeTiming(AGOSTO, '2026-07-15').businessDaysElapsed).toBe(0)
  })

  it('limita a janela de tendência e a encerra na última data com dado', () => {
    const { trendWindow } = computeTiming(AGOSTO, '2026-08-28')

    expect(trendWindow).toHaveLength(JANELA_TENDENCIA_DIAS_UTEIS)
    expect(trendWindow.at(-1)).toBe('2026-08-28')
    expect(trendWindow.every((date) => date <= '2026-08-28')).toBe(true)
  })

  it('a janela atravessa o início do período em busca de histórico', () => {
    // Em 7 de agosto só há 5 dias úteis no mês, mas a tendência do canal
    // continua no fim de julho.
    const { trendWindow } = computeTiming(AGOSTO, '2026-08-07')

    expect(trendWindow).toHaveLength(JANELA_TENDENCIA_DIAS_UTEIS)
    expect(trendWindow[0]).toBe('2026-07-27')
    expect(trendWindow.at(-1)).toBe('2026-08-07')
  })

  it('o histórico disponível limita a janela', () => {
    const { trendWindow } = computeTiming(AGOSTO, '2026-08-07', '2026-08-03')

    expect(trendWindow).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
    ])
  })
})

describe('prorateGoal', () => {
  const index = indexGoals([goal('2026-08', 'organic-search', 21)])

  it('entrega a meta cheia quando o período é o mês inteiro', () => {
    const { target } = prorateGoal(
      index,
      ['organic-search'],
      'customers',
      computeTiming(AGOSTO, '2026-08-31').daysByMonthTotal,
    )

    expect(target).toBe(21)
  })

  it('rateia proporcionalmente aos dias úteis decorridos', () => {
    const { target } = prorateGoal(
      index,
      ['organic-search'],
      'customers',
      computeTiming(AGOSTO, '2026-08-14').daysByMonthElapsed,
    )

    expect(target).toBe(10)
  })

  it('reparte corretamente um período que atravessa dois meses', () => {
    // Junho tem 22 dias úteis, dos quais 15 estão no período; julho tem 23, com 3.
    const crossIndex = indexGoals([
      goal('2026-06', 'organic-search', 44),
      goal('2026-07', 'organic-search', 46),
    ])
    const timing = computeTiming({ from: '2026-06-10', to: '2026-07-05' }, '2026-07-05')

    const { target } = prorateGoal(
      crossIndex,
      ['organic-search'],
      'customers',
      timing.daysByMonthTotal,
    )

    expect(target).toBe(44 * (15 / 22) + 46 * (3 / 23))
    expect(target).toBe(36)
  })

  it('soma as metas de vários canais no consolidado', () => {
    const multi = indexGoals([goal('2026-08', 'organic-search', 21), goal('2026-08', 'direct', 42)])
    const timing = computeTiming(AGOSTO, '2026-08-31')

    expect(
      prorateGoal(multi, ['organic-search', 'direct'], 'customers', timing.daysByMonthTotal).target,
    ).toBe(63)
  })

  it('registra o mês sem meta em vez de tratá-lo como meta zero', () => {
    const timing = computeTiming({ from: '2026-08-01', to: '2026-09-30' }, '2026-09-30')
    const { target, missingMonths } = prorateGoal(
      index,
      ['organic-search'],
      'customers',
      timing.daysByMonthTotal,
    )

    expect(target).toBe(21)
    expect(missingMonths).toEqual(['2026-09'])
  })

  it('soma linhas duplicadas do mesmo mês em vez de a última vencer', () => {
    const duplicated = indexGoals([
      goal('2026-08', 'organic-search', 10),
      goal('2026-08', 'organic-search', 11),
    ])
    const timing = computeTiming(AGOSTO, '2026-08-31')

    expect(
      prorateGoal(duplicated, ['organic-search'], 'customers', timing.daysByMonthTotal).target,
    ).toBe(21)
  })
})

describe('recentDailyRate', () => {
  const snapshots = daily('2026-08-01', '2026-08-14', 'organic-search', { customers: 2 })

  it('divide pelo tamanho da janela', () => {
    const { trendWindow } = computeTiming(AGOSTO, '2026-08-14')

    expect(recentDailyRate(snapshots, 'customers', trendWindow)).toBe(2)
  })

  it('conta dia útil sem linha como zero', () => {
    // Janela de 10 dias úteis, mas só os 5 primeiros têm linha.
    const parcial = daily('2026-08-01', '2026-08-07', 'organic-search', { customers: 2 })
    const { trendWindow } = computeTiming(AGOSTO, '2026-08-14')

    expect(recentDailyRate(parcial, 'customers', trendWindow)).toBe(1)
  })

  it('ignora datas fora da janela', () => {
    expect(recentDailyRate(snapshots, 'customers', ['2026-08-03'])).toBe(2)
  })

  it('devolve zero com janela vazia, sem dividir por zero', () => {
    expect(recentDailyRate(snapshots, 'customers', [])).toBe(0)
  })
})

describe('classifyStatus', () => {
  it('classifica cada faixa', () => {
    expect(classifyStatus(1.4)).toBe('no-ritmo')
    expect(classifyStatus(0.9)).toBe('atencao')
    expect(classifyStatus(0.5)).toBe('risco')
  })

  it('trata as fronteiras como inclusivas na faixa melhor', () => {
    expect(classifyStatus(1)).toBe('no-ritmo')
    expect(classifyStatus(0.8)).toBe('atencao')
    expect(classifyStatus(0.7999)).toBe('risco')
  })

  it('ausência de razão não vira risco', () => {
    expect(classifyStatus(null)).toBe('sem-meta')
  })
})

describe('lastDataDate', () => {
  it('encontra a data mais recente independentemente da ordem', () => {
    expect(
      lastDataDate([
        ...daily('2026-08-05', '2026-08-05', 'a'),
        ...daily('2026-08-12', '2026-08-12', 'a'),
        ...daily('2026-08-03', '2026-08-03', 'a'),
      ]),
    ).toBe('2026-08-12')
  })

  it('devolve null sem dado', () => {
    expect(lastDataDate([])).toBeNull()
  })
})

describe('computeAdherence', () => {
  const goals = [goal('2026-08', 'organic-search', 21)]

  function report(perDay: number, until: string) {
    return computeAdherence({
      snapshots: daily('2026-08-01', until, 'organic-search', { customers: perDay }),
      goals,
      range: AGOSTO,
    })
  }

  function customers(entry: ChannelAdherence): MetricAdherence {
    return entry.metrics.find((metric) => metric.metric === 'customers')!
  }

  it('no ritmo exato: projeta a meta cheia e zera o gap', () => {
    const metric = customers(report(1, '2026-08-14').total)

    expect(metric.actual).toBe(10)
    expect(metric.goalPeriod).toBe(21)
    expect(metric.goalToDate).toBe(10)
    expect(metric.gap).toBe(0)
    expect(metric.recentDailyRate).toBe(1)
    expect(metric.projection).toBe(21)
    expect(metric.projectedAttainment).toBe(1)
    expect(metric.status).toBe('no-ritmo')
    expect(metric.confidence).toBe('normal')
  })

  it('ritmo abaixo do necessário cai em risco, com gap negativo', () => {
    const metric = customers(
      computeAdherence({
        snapshots: [
          ...daily('2026-08-01', '2026-08-07', 'organic-search', { customers: 1 }),
          ...daily('2026-08-10', '2026-08-14', 'organic-search', { customers: 0 }),
        ],
        goals,
        range: AGOSTO,
      }).total,
    )

    expect(metric.actual).toBe(5)
    expect(metric.gap).toBe(-5)
    expect(metric.recentDailyRate).toBe(0.5)
    expect(metric.projection).toBe(5 + 0.5 * 11)
    expect(metric.status).toBe('risco')
  })

  it('projeção entre 80% e 100% cai em atenção', () => {
    const metric = customers(
      computeAdherence({
        snapshots: [
          ...daily('2026-08-01', '2026-08-13', 'organic-search', { customers: 1 }),
          // Dia útil presente com resultado zero: entra na janela e puxa a média.
          ...daily('2026-08-14', '2026-08-14', 'organic-search', { customers: 0 }),
        ],
        goals,
        range: AGOSTO,
      }).total,
    )

    // 9 em 10 dias úteis: projeta 9 + 0,9 × 11 = 18,9, ou 90% de 21.
    expect(metric.projectedAttainment).toBeCloseTo(0.9)
    expect(metric.status).toBe('atencao')
  })

  it('não projeta com menos de uma semana de histórico', () => {
    const metric = customers(report(1, '2026-08-05').total)

    expect(metric.confidence).toBe('insuficiente')
    expect(metric.projection).toBeNull()
    expect(metric.projectedAttainment).toBeNull()
    // Sem projeção, o status compara realizado com a meta proporcional.
    expect(metric.goalToDate).toBe(3)
    expect(metric.status).toBe('no-ritmo')
  })

  it('usa o histórico anterior ao período para calcular o ritmo', () => {
    // Julho rendeu 2 por dia útil; agosto ainda só tem três dias de dado.
    const { total } = computeAdherence({
      snapshots: [
        ...daily('2026-07-20', '2026-07-31', 'organic-search', { customers: 2 }),
        ...daily('2026-08-01', '2026-08-05', 'organic-search', { customers: 2 }),
      ],
      goals,
      range: AGOSTO,
    })

    const metric = customers(total)

    // Só os três dias úteis de agosto entram no realizado.
    expect(metric.actual).toBe(6)
    // Mas a janela de dez dias úteis alcança julho, então há ritmo para projetar.
    expect(metric.recentDailyRate).toBe(2)
    expect(metric.confidence).not.toBe('insuficiente')
    expect(metric.projection).toBe(6 + 2 * 18)
  })

  it('período fechado não extrapola: a projeção é o próprio realizado', () => {
    const metric = customers(report(1, '2026-08-31').total)

    expect(metric.confidence).toBe('periodo-fechado')
    expect(metric.projection).toBe(21)
    expect(metric.projection).toBe(metric.actual)
    expect(metric.status).toBe('no-ritmo')
  })

  it('marca baixa confiança quando pouco do período passou', () => {
    // Setembro de 2026 tem 22 dias úteis; 10 decorridos ficam acima de 30%,
    // então o cenário de baixa confiança precisa de um período mais longo.
    const trimestre = { from: '2026-07-01', to: '2026-09-30' }
    const metric = customers(
      computeAdherence({
        snapshots: daily('2026-07-01', '2026-07-15', 'organic-search', { customers: 1 }),
        goals: [goal('2026-07', 'organic-search', 23)],
        range: trimestre,
      }).total,
    )

    expect(metric.confidence).toBe('baixa')
    expect(metric.projection).not.toBeNull()
  })

  it('canal com meta e sem resultado aparece zerado, não some', () => {
    const { byChannel } = computeAdherence({
      snapshots: daily('2026-08-01', '2026-08-14', 'organic-search', { customers: 1 }),
      goals: [...goals, goal('2026-08', 'referral', 5)],
      range: AGOSTO,
    })

    const referral = byChannel.find((entry) => entry.channel === 'referral')

    expect(referral).toBeDefined()
    expect(customers(referral!).actual).toBe(0)
    expect(customers(referral!).status).toBe('risco')
  })

  it('sem meta cadastrada, o status é neutro e não risco', () => {
    const { total, missingGoalMonths } = computeAdherence({
      snapshots: daily('2026-08-01', '2026-08-14', 'organic-search', { customers: 1 }),
      goals: [],
      range: AGOSTO,
    })

    expect(customers(total).status).toBe('sem-meta')
    expect(customers(total).attainment).toBeNull()
    expect(missingGoalMonths).toEqual(['2026-08'])
  })

  describe('burn-up', () => {
    it('tem um ponto por dia útil do período', () => {
      expect(report(1, '2026-08-14').burnup.customers).toHaveLength(21)
    })

    it('a meta acumulada cresce até a meta cheia', () => {
      const curve = report(1, '2026-08-14').burnup.customers

      expect(curve[0].goal).toBe(1)
      expect(curve[9].goal).toBe(10)
      expect(curve.at(-1)!.goal).toBe(21)
    })

    it('o realizado para no último dia com dado', () => {
      const curve = report(1, '2026-08-14').burnup.customers

      expect(curve[9].date).toBe('2026-08-14')
      expect(curve[9].actual).toBe(10)
      expect(curve[10].actual).toBeNull()
      expect(curve.at(-1)!.actual).toBeNull()
    })

    it('a projeção começa no último dia com dado, para as linhas se encontrarem', () => {
      const curve = report(1, '2026-08-14').burnup.customers

      expect(curve[8].projected).toBeNull()
      expect(curve[9].projected).toBe(curve[9].actual)
      expect(curve.at(-1)!.projected).toBeCloseTo(21)
    })

    it('não desenha projeção quando não há base para projetar', () => {
      const curve = report(1, '2026-08-05').burnup.customers

      expect(curve.every((point) => point.projected === null)).toBe(true)
    })
  })

  it('o consolidado soma os canais', () => {
    const { total, byChannel } = computeAdherence({
      snapshots: [
        ...daily('2026-08-01', '2026-08-14', 'organic-search', { customers: 1 }),
        ...daily('2026-08-01', '2026-08-14', 'direct', { customers: 3 }),
      ],
      goals: [...goals, goal('2026-08', 'direct', 42)],
      range: AGOSTO,
    })

    expect(customers(total).actual).toBe(40)
    expect(customers(total).goalPeriod).toBe(63)
    expect(byChannel.map((entry) => entry.channel)).toEqual(['direct', 'organic-search'])
  })
})
