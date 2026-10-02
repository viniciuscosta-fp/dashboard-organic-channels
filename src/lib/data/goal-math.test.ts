import { describe, expect, it } from 'vitest'

import { countBusinessDays, listBusinessDays, MAX_DIAS_INTERVALO } from '../business-days'
import { MAX_PERIOD_DAYS, PERIOD_PRESET_IDS, resolvePreset } from '../period'
import {
  classifyStatus,
  computeAdherence,
  computeTiming,
  dataRangeFor,
  dataRangeWithComparisonFor,
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

    it('sem canal em foco, a curva é a do consolidado', () => {
      expect(report(1, '2026-08-14').burnupChannel).toBeNull()
    })
  })

  describe('burn-up com canal em foco', () => {
    const doisCanais = {
      snapshots: [
        ...daily('2026-08-01', '2026-08-14', 'organic-search', { customers: 1 }),
        ...daily('2026-08-01', '2026-08-14', 'direct', { customers: 3 }),
      ],
      goals: [...goals, goal('2026-08', 'direct', 42)],
      range: AGOSTO,
    }

    it('a curva passa a ser do canal, não do consolidado', () => {
      const { burnup, burnupChannel } = computeAdherence({
        ...doisCanais,
        focusChannel: 'direct',
      })

      expect(burnupChannel).toBe('direct')
      expect(burnup.customers[9].actual).toBe(30)
      expect(burnup.customers.at(-1)!.goal).toBe(42)
    })

    it('a curva do canal não diverge do cartão de KPI do mesmo canal', () => {
      const relatorio = computeAdherence({ ...doisCanais, focusChannel: 'direct' })
      const cartao = customers(relatorio.byChannel.find((e) => e.channel === 'direct')!)

      const ultimoComDado = relatorio.burnup.customers.findLast((p) => p.actual !== null)!

      expect(ultimoComDado.actual).toBe(cartao.actual)
      expect(relatorio.burnup.customers.at(-1)!.goal).toBeCloseTo(cartao.goalPeriod)
      expect(relatorio.burnup.customers.at(-1)!.projected).toBeCloseTo(cartao.projection!)
    })

    it('o rateio da meta dos demais canais não muda quando um canal é focado', () => {
      const consolidado = computeAdherence(doisCanais)
      const focado = computeAdherence({ ...doisCanais, focusChannel: 'direct' })

      expect(customers(focado.total)).toEqual(customers(consolidado.total))
      expect(focado.byChannel).toEqual(consolidado.byChannel)
    })

    it('a curva sobe pelo ritmo do canal focado, não pelo do consolidado', () => {
      const relatorio = computeAdherence({ ...doisCanais, focusChannel: 'direct' })
      const curva = relatorio.burnup.customers

      const ancora = curva.findLastIndex((point) => point.actual !== null)
      const passo = curva[ancora + 1].projected! - curva[ancora].projected!

      // `direct` faz 3 por dia útil; o consolidado faz 4.
      expect(passo).toBeCloseTo(3)
      expect(customers(relatorio.total).recentDailyRate).toBeCloseTo(4)
    })

    it('canal focado sem histórico suficiente fica sem projeção na curva', () => {
      const { burnup } = computeAdherence({
        snapshots: [
          ...daily('2026-08-01', '2026-08-05', 'organic-search', { customers: 1 }),
          ...daily('2026-08-01', '2026-08-05', 'direct', { customers: 3 }),
        ],
        goals: [...goals, goal('2026-08', 'direct', 42)],
        range: AGOSTO,
        focusChannel: 'direct',
      })

      expect(burnup.customers.every((point) => point.projected === null)).toBe(true)
    })

    it('canal parado dentro da janela tem o ritmo puxado pelos dias zerados', () => {
      // Dia útil sem linha é um dia de resultado zero, não um dia que não
      // existiu — a curva do canal precisa refletir isso.
      const relatorio = computeAdherence({
        snapshots: [
          ...daily('2026-08-01', '2026-08-14', 'organic-search', { customers: 1 }),
          ...daily('2026-08-01', '2026-08-05', 'direct', { customers: 3 }),
        ],
        goals: [...goals, goal('2026-08', 'direct', 42)],
        range: AGOSTO,
        focusChannel: 'direct',
      })

      // 9 clientes em três dias, sobre uma janela de dez dias úteis.
      expect(
        customers(relatorio.byChannel.find((e) => e.channel === 'direct')!).recentDailyRate,
      ).toBeCloseTo(0.9)
    })

    it('canal em foco desconhecido cai no consolidado, em vez de esvaziar a curva', () => {
      const { burnup, burnupChannel } = computeAdherence({
        ...doisCanais,
        focusChannel: 'canal_que_nao_existe',
      })

      expect(burnupChannel).toBeNull()
      expect(burnup.customers[9].actual).toBe(40)
    })
  })

  describe('grupo em foco', () => {
    const tresCanais = {
      snapshots: [
        ...daily('2026-08-01', '2026-08-14', 'organic-search', { customers: 1 }),
        ...daily('2026-08-01', '2026-08-14', 'direct', { customers: 3 }),
        ...daily('2026-08-01', '2026-08-14', 'paid', { customers: 2 }),
      ],
      goals: [...goals, goal('2026-08', 'direct', 42), goal('2026-08', 'paid', 30)],
      range: AGOSTO,
    }

    it('sem foco, o escopo é o consolidado', () => {
      const relatorio = computeAdherence(tresCanais)

      expect(relatorio.scope).toBe(relatorio.total)
    })

    it('com canal em foco, o escopo é a linha do canal', () => {
      const relatorio = computeAdherence({ ...tresCanais, focusChannel: 'direct' })

      expect(relatorio.scope).toEqual(relatorio.byChannel.find((e) => e.channel === 'direct'))
    })

    it('soma realizado, meta e ritmo dos canais do grupo', () => {
      const { scope } = computeAdherence({ ...tresCanais, focusChannels: ['direct', 'paid'] })
      const metric = customers(scope)

      expect(metric.actual).toBe(50)
      expect(metric.goalPeriod).toBe(72)
      expect(metric.recentDailyRate).toBeCloseTo(5)
    })

    it('a curva do grupo sai do mesmo cálculo que os cartões', () => {
      const relatorio = computeAdherence({ ...tresCanais, focusChannels: ['direct', 'paid'] })
      const cartao = customers(relatorio.scope)
      const curva = relatorio.burnup.customers

      expect(curva.findLast((p) => p.actual !== null)!.actual).toBe(cartao.actual)
      expect(curva.at(-1)!.goal).toBeCloseTo(cartao.goalPeriod)
      expect(curva.at(-1)!.projected).toBeCloseTo(cartao.projection!)
      expect(relatorio.burnupChannel).toBeNull()
    })

    it('não recorta o universo: total e linhas por canal não mudam', () => {
      const consolidado = computeAdherence(tresCanais)
      const comGrupo = computeAdherence({ ...tresCanais, focusChannels: ['direct', 'paid'] })

      expect(comGrupo.total).toEqual(consolidado.total)
      expect(comGrupo.byChannel).toEqual(consolidado.byChannel)
    })

    it('tem precedência sobre o canal em foco', () => {
      const { scope } = computeAdherence({
        ...tresCanais,
        focusChannel: 'organic-search',
        focusChannels: ['direct', 'paid'],
      })

      expect(customers(scope).actual).toBe(50)
    })

    it('ignora canal desconhecido e, sem nenhum conhecido, cai no consolidado', () => {
      const parcial = computeAdherence({ ...tresCanais, focusChannels: ['direct', 'fantasma'] })
      const vazio = computeAdherence({ ...tresCanais, focusChannels: ['fantasma'] })

      expect(customers(parcial.scope).actual).toBe(30)
      expect(vazio.scope).toBe(vazio.total)
    })
  })

  it('canal cadastrado, sem dado e sem meta, aparece zerado', () => {
    const { byChannel } = computeAdherence({
      snapshots: daily('2026-08-01', '2026-08-14', 'organic-search', { customers: 1 }),
      goals,
      range: AGOSTO,
      channels: ['organic-search', 'recem_cadastrado'],
    })

    const novo = byChannel.find((entry) => entry.channel === 'recem_cadastrado')

    expect(novo).toBeDefined()
    expect(customers(novo!).actual).toBe(0)
    expect(customers(novo!).status).toBe('sem-meta')
  })

  it('o cadastro não substitui os canais derivados do dado e das metas', () => {
    const { byChannel } = computeAdherence({
      snapshots: daily('2026-08-01', '2026-08-14', 'organic-search', { customers: 1 }),
      goals: [...goals, goal('2026-08', 'canal_fora_do_cadastro', 5)],
      range: AGOSTO,
      channels: ['recem_cadastrado'],
    })

    expect(byChannel.map((entry) => entry.channel)).toEqual([
      'canal_fora_do_cadastro',
      'organic-search',
      'recem_cadastrado',
    ])
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

describe('dataRangeWithComparisonFor', () => {
  const HOJE = '2026-08-14'

  it('recua o suficiente para a pior janela anterior caber', () => {
    const range = resolvePreset('mes-atual', HOJE)
    const largo = dataRangeWithComparisonFor(range, HOJE)

    // A janela anterior nunca passa dos dias úteis do período inteiro.
    const uteisDoPeriodo = countBusinessDays(range.from, range.to)

    expect(countBusinessDays(largo.from, range.from)).toBeGreaterThan(uteisDoPeriodo)
  })

  it('cobre todos os presets', () => {
    for (const preset of PERIOD_PRESET_IDS) {
      const range = resolvePreset(preset, HOJE)
      const largo = dataRangeWithComparisonFor(range, HOJE)

      expect(countBusinessDays(largo.from, range.from)).toBeGreaterThan(
        countBusinessDays(range.from, range.to),
      )
    }
  })

  it('não pede dado futuro', () => {
    const range = resolvePreset('mes-atual', HOJE)

    expect(dataRangeWithComparisonFor(range, HOJE).to).toBe(HOJE)
  })

  it('o pior caso continua abaixo do teto de iteração', () => {
    // Sem isto, subir MAX_PERIOD_DAYS passaria a truncar a série em silêncio.
    const range = { from: '2026-01-01', to: addDiasCorridos('2026-01-01', MAX_PERIOD_DAYS - 1) }
    const largo = dataRangeWithComparisonFor(range, '2027-12-31')

    expect(diasCorridos(largo.from, largo.to)).toBeLessThan(MAX_DIAS_INTERVALO)
  })

  it('o relatório de aderência é idêntico com o intervalo largo', () => {
    // O intervalo maior existe só para a comparação: não pode mexer em nenhum
    // número que já estava na tela.
    const goals = [goal('2026-08', 'organic-search', 21)]
    const todos = daily('2026-05-01', '2026-08-14', 'organic-search', { customers: 1 })

    const estreito = todos.filter((s) => s.date >= dataRangeFor(AGOSTO, '2026-08-14').from)
    const largo = todos.filter(
      (s) => s.date >= dataRangeWithComparisonFor(AGOSTO, '2026-08-14').from,
    )

    expect(largo.length).toBeGreaterThan(estreito.length)
    expect(computeAdherence({ snapshots: largo, goals, range: AGOSTO })).toEqual(
      computeAdherence({ snapshots: estreito, goals, range: AGOSTO }),
    )
  })
})

function addDiasCorridos(iso: string, dias: number): string {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + dias)
  return date.toISOString().slice(0, 10)
}

function diasCorridos(from: string, to: string): number {
  const inicio = new Date(`${from}T00:00:00Z`).getTime()
  const fim = new Date(`${to}T00:00:00Z`).getTime()
  return Math.round((fim - inicio) / 86_400_000) + 1
}

describe('burn-up com registro de fim de semana', () => {
  /** Gera uma linha por dia **corrido**, inclusive sábado e domingo. */
  function everyDay(
    from: string,
    to: string,
    channel: string,
    perDay: Partial<FunnelTotals> = {},
  ): FunnelSnapshot[] {
    const rows: FunnelSnapshot[] = []
    let date = from

    while (date <= to) {
      rows.push({
        date,
        channel,
        revenue: perDay.revenue ?? 0,
        mqls: perDay.mqls ?? 0,
        opportunities: perDay.opportunities ?? 0,
        customers: perDay.customers ?? 0,
      })
      date = addDiasCorridos(date, 1)
    }

    return rows
  }

  const goals = [goal('2026-08', 'organic-search', 21)]

  function customers(entry: ChannelAdherence): MetricAdherence {
    return entry.metrics.find((metric) => metric.metric === 'customers')!
  }

  it('a curva não perde o que foi registrado no fim de semana', () => {
    // 1 e 2 de agosto são sábado e domingo; 8 e 9 também. Somando só dias úteis,
    // a curva ficaria 4 clientes abaixo do realizado dos cartões.
    const relatorio = computeAdherence({
      snapshots: everyDay('2026-08-01', '2026-08-12', 'organic-search', { customers: 1 }),
      goals,
      range: AGOSTO,
    })

    const cartao = customers(relatorio.total)
    const ultimoComDado = relatorio.burnup.customers.findLast((point) => point.actual !== null)!

    expect(cartao.actual).toBe(12)
    expect(ultimoComDado.date).toBe('2026-08-12')
    expect(ultimoComDado.actual).toBe(12)
  })

  it('a projeção do fim da curva bate com a do cartão', () => {
    const relatorio = computeAdherence({
      snapshots: everyDay('2026-07-20', '2026-08-12', 'organic-search', { customers: 1 }),
      goals,
      range: AGOSTO,
    })

    const cartao = customers(relatorio.total)

    expect(relatorio.burnup.customers.at(-1)!.projected).toBeCloseTo(cartao.projection!)
  })

  it('o fim de semana entra no acumulado da segunda seguinte', () => {
    const relatorio = computeAdherence({
      snapshots: everyDay('2026-08-03', '2026-08-11', 'organic-search', { customers: 1 }),
      goals,
      range: AGOSTO,
    })
    const curva = relatorio.burnup.customers

    // 3 a 7 de agosto são cinco dias úteis; 8 e 9 são o fim de semana; 10 é
    // segunda. O salto de 5 para 8 é o fim de semana entrando.
    expect(curva[4].date).toBe('2026-08-07')
    expect(curva[4].actual).toBe(5)
    expect(curva[5].date).toBe('2026-08-10')
    expect(curva[5].actual).toBe(8)
  })

  it('dado que termina no sábado entra no último ponto útil', () => {
    // 15 de agosto de 2026 é um sábado: o último dia útil é 14, e o acumulado
    // dele precisa incluir o sábado.
    const relatorio = computeAdherence({
      snapshots: everyDay('2026-08-01', '2026-08-15', 'organic-search', { customers: 1 }),
      goals,
      range: AGOSTO,
    })

    const ultimoComDado = relatorio.burnup.customers.findLast((point) => point.actual !== null)!

    expect(ultimoComDado.date).toBe('2026-08-14')
    expect(ultimoComDado.actual).toBe(15)
    expect(ultimoComDado.actual).toBe(customers(relatorio.total).actual)
  })

  it('vale também com um canal em foco', () => {
    const relatorio = computeAdherence({
      snapshots: [
        ...everyDay('2026-08-01', '2026-08-12', 'organic-search', { customers: 1 }),
        ...everyDay('2026-08-01', '2026-08-12', 'direct', { customers: 3 }),
      ],
      goals: [...goals, goal('2026-08', 'direct', 42)],
      range: AGOSTO,
      focusChannel: 'direct',
    })

    const cartao = customers(relatorio.byChannel.find((e) => e.channel === 'direct')!)
    const ultimoComDado = relatorio.burnup.customers.findLast((point) => point.actual !== null)!

    expect(cartao.actual).toBe(36)
    expect(ultimoComDado.actual).toBe(36)
  })
})
