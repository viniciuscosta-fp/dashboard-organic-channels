import {
  addDays,
  businessDaysByMonth,
  businessDaysInMonth,
  calendarSpanForBusinessDays,
  countBusinessDays,
  eachDay,
  lastBusinessDaysUpTo,
  listBusinessDays,
  monthOf,
  type IsoMonth,
} from '../business-days'
import type { DateRange } from '../period'
import { listChannels } from './funnel-query'
import { METRICS, type FunnelSnapshot, type Metric, type MonthlyGoal } from './types'

/**
 * Inteligência de aderência a meta.
 *
 * Tudo aqui é função pura. Nenhuma leitura de relógio, de rede ou de ambiente —
 * `hoje` chega como argumento. Isso não é purismo: uma data lida dentro do
 * escopo de `use cache` congelaria por uma hora e a projeção erraria.
 */

/**
 * Janela da tendência recente, em dias úteis. Dez equivale a duas semanas
 * cheias, o que neutraliza o efeito de dia da semana.
 *
 * A janela **atravessa** o início do período de propósito: no dia 5 de um mês,
 * a tendência do canal são os dias úteis do fim do mês anterior. Limitá-la ao
 * período deixaria a primeira quinzena inteira sem projeção.
 */
export const JANELA_TENDENCIA_DIAS_UTEIS = 10

/** Quantos dias corridos de histórico buscar antes do período, para a janela caber. */
export const LOOKBACK_TENDENCIA_DIAS = 21

/** Abaixo disto não há tendência que se sustente — uma semana de dias úteis. */
export const MINIMO_DIAS_TENDENCIA = 5

/** Projeção acima disso é "no ritmo". */
export const LIMIAR_NO_RITMO = 1

/** Entre este valor e `LIMIAR_NO_RITMO` é "atenção"; abaixo, "risco". */
export const LIMIAR_ATENCAO = 0.8

/** Abaixo desta fração do período decorrido, a projeção sai com aviso. */
export const RITMO_MINIMO_CONFIANCA = 0.3

export type GoalStatus = 'no-ritmo' | 'atencao' | 'risco' | 'sem-meta'

export type ProjectionConfidence =
  /** Período já fechado: o realizado é o resultado final. */
  | 'periodo-fechado'
  /** Dias úteis decorridos insuficientes para uma janela de tendência. */
  | 'insuficiente'
  /** Projeta, mas pouco do período passou. */
  | 'baixa'
  | 'normal'

export interface PeriodTiming {
  range: DateRange
  /** Última data com dado no período. `null` quando não há dado nenhum. */
  lastDataDate: string | null
  businessDaysTotal: number
  businessDaysElapsed: number
  businessDaysRemaining: number
  /** Fração do período já decorrida, de 0 a 1. */
  elapsedRatio: number
  /** Dias úteis por mês em todo o período — denominador do rateio da meta cheia. */
  daysByMonthTotal: Map<IsoMonth, number>
  /** Dias úteis por mês já decorridos — rateio da meta proporcional. */
  daysByMonthElapsed: Map<IsoMonth, number>
  /**
   * Dias úteis da janela de tendência que têm histórico disponível, em ordem
   * crescente. Pode começar antes do período.
   */
  trendWindow: string[]
}

/**
 * Intervalo de dados a buscar para atender um período.
 *
 * Estende para trás o suficiente para a janela de tendência caber, e **nunca**
 * pede data futura: dado de amanhã não existe em fonte nenhuma.
 */
export function dataRangeFor(range: DateRange, today: string): DateRange {
  return {
    from: addDays(range.from, -LOOKBACK_TENDENCIA_DIAS),
    to: range.to < today ? range.to : today,
  }
}

/**
 * Intervalo a buscar quando o dashboard também compara com o período anterior.
 *
 * É **determinístico**: depende só do recorte e de hoje, nunca do dado. É isso
 * que mantém uma chave de cache e uma ida à fonte, mesmo que o tamanho exato da
 * janela anterior só seja conhecido depois de ler o dado — o limite superior
 * dela (os dias úteis do período inteiro) é calculável antes.
 *
 * A alternativa seria uma segunda chamada a `getFunnelSnapshots` com a janela
 * anterior. Seria legítima quanto às regras de cache, mas `SheetsFunnelRepository`
 * lê a aba inteira e filtra em memória: a segunda chamada custaria outra leitura
 * completa da API, serializada depois da primeira, para obter linhas que a
 * primeira já poderia ter trazido.
 */
export function dataRangeWithComparisonFor(range: DateRange, today: string): DateRange {
  const base = dataRangeFor(range, today)
  const span = calendarSpanForBusinessDays(countBusinessDays(range.from, range.to))

  return { from: addDays(base.from, -span), to: base.to }
}

export interface MetricAdherence {
  metric: Metric
  actual: number
  /** Meta rateada para o período inteiro. */
  goalPeriod: number
  /** Meta rateada apenas para os dias úteis já decorridos. */
  goalToDate: number
  /** Realizado menos meta proporcional. Negativo significa atrás do ritmo. */
  gap: number
  /** Realizado sobre meta do período. `null` quando não há meta. */
  attainment: number | null
  /** Média por dia útil na janela de tendência. */
  recentDailyRate: number
  /** Fechamento estimado. `null` quando não há base para projetar. */
  projection: number | null
  /** Projeção sobre meta do período. `null` quando não há meta ou projeção. */
  projectedAttainment: number | null
  status: GoalStatus
  confidence: ProjectionConfidence
  /** Meses do período sem meta cadastrada para esta métrica e canal. */
  missingGoalMonths: IsoMonth[]
}

export interface ChannelAdherence {
  channel: string
  metrics: MetricAdherence[]
}

/** Um dia útil do período na curva de burn-up. */
export interface BurnupPoint {
  date: string
  /** Realizado acumulado. `null` nos dias ainda sem dado. */
  actual: number | null
  /** Meta acumulada até este dia — o ritmo que era esperado. */
  goal: number
  /** Continuação estimada. `null` antes do último dia com dado. */
  projected: number | null
}

export interface AdherenceReport {
  timing: PeriodTiming
  /** Consolidado de todos os canais. */
  total: ChannelAdherence
  byChannel: ChannelAdherence[]
  /**
   * Curva acumulada por métrica, no escopo pedido em `focusChannel` — o
   * consolidado quando não há canal em foco.
   */
  burnup: Record<Metric, BurnupPoint[]>
  /** Canal a que a curva se refere. `null` quando ela é do consolidado. */
  burnupChannel: string | null
  /** União dos meses sem meta, em qualquer canal ou métrica. */
  missingGoalMonths: IsoMonth[]
}

/**
 * Monta a régua temporal do período.
 *
 * O decorrido é medido contra a **última data com dado**, não contra o
 * calendário. Se o flow do n8n atrasar um dia, medir pelo calendário diluiria o
 * realizado por um dia a mais e acusaria um atraso que não existe.
 */
export function computeTiming(
  range: DateRange,
  lastDataDate: string | null,
  firstDataDate: string | null = null,
): PeriodTiming {
  const businessDaysTotal = countBusinessDays(range.from, range.to)

  const elapsedEnd =
    lastDataDate && lastDataDate >= range.from
      ? lastDataDate < range.to
        ? lastDataDate
        : range.to
      : null

  const businessDaysElapsed = elapsedEnd ? countBusinessDays(range.from, elapsedEnd) : 0

  // A janela recua para antes do período; o histórico disponível é que a limita.
  const trendWindow = elapsedEnd
    ? lastBusinessDaysUpTo(elapsedEnd, JANELA_TENDENCIA_DIAS_UTEIS).filter(
        (date) => firstDataDate === null || date >= firstDataDate,
      )
    : []

  return {
    range,
    lastDataDate,
    businessDaysTotal,
    businessDaysElapsed,
    businessDaysRemaining: Math.max(0, businessDaysTotal - businessDaysElapsed),
    elapsedRatio: businessDaysTotal === 0 ? 0 : businessDaysElapsed / businessDaysTotal,
    daysByMonthTotal: businessDaysByMonth(range.from, range.to),
    daysByMonthElapsed: elapsedEnd
      ? businessDaysByMonth(range.from, elapsedEnd)
      : new Map<IsoMonth, number>(),
    trendWindow,
  }
}

type GoalKey = string

function goalKey(channel: string, metric: Metric, month: IsoMonth): GoalKey {
  return `${channel}|${metric}|${month}`
}

export type GoalIndex = Map<GoalKey, number>

export function indexGoals(goals: readonly MonthlyGoal[]): GoalIndex {
  const index: GoalIndex = new Map()

  for (const goal of goals) {
    const key = goalKey(goal.channel, goal.metric, goal.month)
    // Linha duplicada na planilha soma, em vez de a última silenciosamente vencer.
    index.set(key, (index.get(key) ?? 0) + goal.target)
  }

  return index
}

export interface ProratedGoal {
  target: number
  missingMonths: IsoMonth[]
}

/**
 * Rateia metas mensais para um recorte de dias úteis.
 *
 * Para cada mês tocado pelo período, toma a meta mensal e multiplica pela
 * fração de dias úteis daquele mês que está dentro do recorte. Um período de
 * 10 de junho a 5 de julho pega parte de junho e parte de julho, cada uma
 * proporcional aos seus próprios dias úteis.
 *
 * `channels` vazio significa "todos os canais": é assim que o consolidado é
 * calculado, somando as metas de cada canal.
 */
export function prorateGoal(
  index: GoalIndex,
  channels: readonly string[],
  metric: Metric,
  daysByMonth: Map<IsoMonth, number>,
): ProratedGoal {
  let target = 0
  const missingMonths: IsoMonth[] = []

  for (const [month, days] of daysByMonth) {
    const monthTotal = businessDaysInMonth(month)
    if (monthTotal === 0) continue

    let monthlyTarget = 0
    let found = false

    for (const channel of channels) {
      const value = index.get(goalKey(channel, metric, month))
      if (value !== undefined) {
        monthlyTarget += value
        found = true
      }
    }

    // Mês sem meta contribui zero, mas é registrado: meta ausente virando meta
    // zero silenciosamente faria o dashboard mostrar 100% de atingimento
    // contra nada.
    if (!found) {
      missingMonths.push(month)
      continue
    }

    target += monthlyTarget * (days / monthTotal)
  }

  return { target, missingMonths }
}

/**
 * Média por dia útil na janela de tendência.
 *
 * Divide pelo número de dias da janela, não pelo número de linhas encontradas:
 * dia útil sem linha na planilha é um dia de resultado zero, não um dia que não
 * existiu.
 */
export function recentDailyRate(
  snapshots: readonly FunnelSnapshot[],
  metric: Metric,
  trendWindow: readonly string[],
): number {
  if (trendWindow.length === 0) return 0

  const window = new Set(trendWindow)
  let total = 0

  for (const snapshot of snapshots) {
    if (window.has(snapshot.date)) total += snapshot[metric]
  }

  return total / trendWindow.length
}

export function classifyStatus(ratio: number | null): GoalStatus {
  if (ratio === null) return 'sem-meta'
  if (ratio >= LIMIAR_NO_RITMO) return 'no-ritmo'
  if (ratio >= LIMIAR_ATENCAO) return 'atencao'
  return 'risco'
}

function buildMetricAdherence(
  periodSnapshots: readonly FunnelSnapshot[],
  trendSnapshots: readonly FunnelSnapshot[],
  index: GoalIndex,
  channels: readonly string[],
  metric: Metric,
  timing: PeriodTiming,
): MetricAdherence {
  const actual = periodSnapshots.reduce((sum, snapshot) => sum + snapshot[metric], 0)

  const period = prorateGoal(index, channels, metric, timing.daysByMonthTotal)
  const toDate = prorateGoal(index, channels, metric, timing.daysByMonthElapsed)

  // O ritmo olha o histórico completo, inclusive antes do período: o que
  // interessa é a velocidade do canal, não a do recorte selecionado.
  const rate = recentDailyRate(trendSnapshots, metric, timing.trendWindow)

  let confidence: ProjectionConfidence
  let projection: number | null

  if (timing.businessDaysRemaining === 0) {
    confidence = 'periodo-fechado'
    projection = actual
  } else if (timing.trendWindow.length < MINIMO_DIAS_TENDENCIA) {
    confidence = 'insuficiente'
    projection = null
  } else {
    confidence = timing.elapsedRatio < RITMO_MINIMO_CONFIANCA ? 'baixa' : 'normal'
    projection = actual + rate * timing.businessDaysRemaining
  }

  const attainment = period.target > 0 ? actual / period.target : null
  const projectedAttainment =
    projection !== null && period.target > 0 ? projection / period.target : null

  // Sem projeção confiável, o status ainda pode dizer algo útil: comparar o
  // realizado com a meta proporcional responde "estou atrás do ritmo agora?",
  // que é pergunta diferente de "vou fechar abaixo?" mas igualmente acionável.
  const statusRatio = projectedAttainment ?? (toDate.target > 0 ? actual / toDate.target : null)

  return {
    metric,
    actual,
    goalPeriod: period.target,
    goalToDate: toDate.target,
    gap: actual - toDate.target,
    attainment,
    recentDailyRate: rate,
    projection,
    projectedAttainment,
    status: period.target === 0 ? 'sem-meta' : classifyStatus(statusRatio),
    confidence,
    missingGoalMonths: period.missingMonths,
  }
}

/**
 * Curva acumulada de um período: realizado, meta e continuação estimada.
 *
 * Os **pontos** são os dias úteis do período: nem a meta nem o ritmo avançam no
 * fim de semana, e pontos de sábado e domingo só acrescentariam degraus planos.
 *
 * Mas o **acumulado** varre todos os dias corridos. Isso não é detalhe: a coleta
 * grava sábado e domingo, e somar só o registro do próprio dia útil descartaria
 * esse resultado em silêncio — a curva ficaria abaixo do realizado que os
 * cartões mostram, com a diferença crescendo ao longo do período. O que houve no
 * fim de semana entra no acumulado da segunda seguinte, que é onde ele já estava
 * cronologicamente.
 *
 * O último ponto com dado varre até `lastDataDate`, que pode cair num sábado.
 * Assim o fim da curva é exatamente `MetricAdherence.actual`, e o fim da
 * projeção é exatamente `MetricAdherence.projection`.
 *
 * A projeção começa exatamente no último ponto com dado, e não no dia seguinte,
 * para as duas linhas se encontrarem em vez de aparecerem descoladas.
 */
export function buildBurnup(
  periodSnapshots: readonly FunnelSnapshot[],
  index: GoalIndex,
  channels: readonly string[],
  metric: Metric,
  timing: PeriodTiming,
  dailyRate: number | null,
): BurnupPoint[] {
  const byDate = new Map<string, number>()
  for (const snapshot of periodSnapshots) {
    byDate.set(snapshot.date, (byDate.get(snapshot.date) ?? 0) + snapshot[metric])
  }

  const businessDays = listBusinessDays(timing.range.from, timing.range.to)
  const lastData = timing.lastDataDate

  // Onde o realizado para. `null` quando o período ainda não alcançou nenhum
  // dia útil com dado.
  const anchorDate =
    lastData === null ? null : (businessDays.filter((date) => date <= lastData).at(-1) ?? null)

  const running = new Map<IsoMonth, number>()
  let cumulative = 0
  let cursor = timing.range.from

  const points: BurnupPoint[] = businessDays.map((date) => {
    const month = monthOf(date)
    running.set(month, (running.get(month) ?? 0) + 1)

    const elapsed = anchorDate !== null && date <= anchorDate

    if (elapsed) {
      const until = date === anchorDate && lastData !== null && lastData > date ? lastData : date

      for (const day of eachDay(cursor, until)) {
        cumulative += byDate.get(day) ?? 0
      }
      cursor = addDays(until, 1)
    }

    return {
      date,
      actual: elapsed ? cumulative : null,
      goal: prorateGoal(index, channels, metric, running).target,
      projected: null,
    }
  })

  if (dailyRate === null) return points

  const anchor = points.findLastIndex((point) => point.actual !== null)
  if (anchor === -1) return points

  points[anchor].projected = points[anchor].actual
  for (let index = anchor + 1; index < points.length; index += 1) {
    points[index].projected = points[index - 1].projected! + dailyRate
  }

  return points
}

/** Data mais recente presente nos snapshots. */
export function lastDataDate(snapshots: readonly FunnelSnapshot[]): string | null {
  return snapshots.reduce<string | null>(
    (latest, snapshot) => (latest === null || snapshot.date > latest ? snapshot.date : latest),
    null,
  )
}

/** Data mais antiga presente nos snapshots. */
export function firstDataDate(snapshots: readonly FunnelSnapshot[]): string | null {
  return snapshots.reduce<string | null>(
    (earliest, snapshot) =>
      earliest === null || snapshot.date < earliest ? snapshot.date : earliest,
    null,
  )
}

export interface AdherenceInput {
  /**
   * Snapshots incluindo o histórico anterior ao período — use `dataRangeFor`
   * para montar a consulta. O recorte do período acontece aqui dentro.
   */
  snapshots: readonly FunnelSnapshot[]
  goals: readonly MonthlyGoal[]
  range: DateRange
  /**
   * Canais conhecidos além dos que aparecem no dado e nas metas — na prática, o
   * cadastro da aba `canais`. São **unidos** aos derivados, nunca os
   * substituem: um canal cadastrado, sem dado e sem meta ainda precisa aparecer
   * zerado, e um canal com meta não pode sumir por não estar no cadastro.
   */
  channels?: readonly string[]
  /**
   * Canal ao qual a curva de burn-up se refere. Ausente devolve o consolidado.
   *
   * Só a curva muda: `total` e `byChannel` saem sempre completos, e o conjunto
   * de canais que rateia a meta **não** é afetado. Focar um canal é escolher o
   * que a curva mostra, não recortar o universo do cálculo.
   */
  focusChannel?: string | null
}

export function computeAdherence({
  snapshots,
  goals,
  range,
  channels: knownChannels,
  focusChannel = null,
}: AdherenceInput): AdherenceReport {
  const inPeriod = snapshots.filter(
    (snapshot) => snapshot.date >= range.from && snapshot.date <= range.to,
  )

  const timing = computeTiming(range, lastDataDate(inPeriod), firstDataDate(snapshots))
  const index = indexGoals(goals)

  // Canais conhecidos vêm do dado, das metas **e** do cadastro: um canal com
  // meta e sem nenhum resultado no período precisa aparecer, justamente por
  // estar zerado — e o mesmo vale para um canal recém-cadastrado.
  const channels = [
    ...new Set([
      ...listChannels(inPeriod),
      ...goals.map((goal) => goal.channel),
      ...(knownChannels ?? []),
    ]),
  ].sort()

  const total: ChannelAdherence = {
    channel: 'total',
    metrics: METRICS.map((metric) =>
      buildMetricAdherence(inPeriod, snapshots, index, channels, metric, timing),
    ),
  }

  const byChannel: ChannelAdherence[] = channels.map((channel) => {
    const ofChannel = (list: readonly FunnelSnapshot[]) =>
      list.filter((snapshot) => snapshot.channel === channel)

    return {
      channel,
      metrics: METRICS.map((metric) =>
        buildMetricAdherence(
          ofChannel(inPeriod),
          ofChannel(snapshots),
          index,
          [channel],
          metric,
          timing,
        ),
      ),
    }
  })

  const missingGoalMonths = [
    ...new Set(
      [total, ...byChannel].flatMap((entry) =>
        entry.metrics.flatMap((metric) => metric.missingGoalMonths),
      ),
    ),
  ].sort()

  // A curva sai do **mesmo** `ChannelAdherence` que alimenta os cartões de KPI.
  // Recalcular o ritmo aqui seria a forma mais fácil de a curva e o número
  // acima dela passarem a discordar.
  const focus =
    focusChannel === null
      ? null
      : (byChannel.find((entry) => entry.channel === focusChannel) ?? null)

  const burnupSnapshots = focus
    ? inPeriod.filter((snapshot) => snapshot.channel === focus.channel)
    : inPeriod
  const burnupChannels = focus ? [focus.channel] : channels

  const burnup = Object.fromEntries(
    (focus ?? total).metrics.map((metric) => [
      metric.metric,
      buildBurnup(
        burnupSnapshots,
        index,
        burnupChannels,
        metric.metric,
        timing,
        metric.projection === null ? null : metric.recentDailyRate,
      ),
    ]),
  ) as Record<Metric, BurnupPoint[]>

  return {
    timing,
    total,
    byChannel,
    burnup,
    burnupChannel: focus?.channel ?? null,
    missingGoalMonths,
  }
}
