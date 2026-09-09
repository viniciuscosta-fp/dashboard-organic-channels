import type { DateRange } from '../period'
import { previousComparableRange } from '../period'
import { applyFunnelQuery, listChannels, sumMetrics } from './funnel-query'
import type { PeriodTiming } from './goal-math'
import { relativeChange } from './ratio'
import { METRICS, type FunnelSnapshot, type Metric } from './types'

/**
 * Comparação com o período anterior equivalente.
 *
 * Responde "isso é novo ou já vinha assim?", que é pergunta diferente de "estou
 * aderente à meta?" — por isso mora aqui e não em `goal-math.ts`. Função pura,
 * sem relógio: a régua de tempo chega pronta em `timing`.
 */

export type ComparisonUnavailable =
  /** Nenhum dado no período: não há janela atual a comparar. */
  | 'sem-dado-no-periodo'
  /** A janela anterior começa antes do primeiro dado que a fonte tem. */
  | 'historico-insuficiente'

export interface MetricComparison {
  metric: Metric
  current: number
  previous: number
  /** Diferença absoluta, na unidade da métrica. */
  delta: number
  /** Variação relativa. `null` quando a base anterior é zero. */
  relative: number | null
}

export interface ChannelComparison {
  /** Chave do canal, ou `'total'` no consolidado. */
  channel: string
  metrics: MetricComparison[]
}

export interface PeriodComparison {
  /** Janela realizada do recorte atual: do início até a última data com dado. */
  currentRange: DateRange | null
  previousRange: DateRange | null
  /** Dias úteis de cada uma das duas janelas — são iguais por construção. */
  businessDays: number
  total: ChannelComparison | null
  byChannel: ChannelComparison[]
  /** Por que a comparação não pode ser feita. `null` quando pode. */
  unavailable: ComparisonUnavailable | null
}

export interface PeriodComparisonInput {
  /**
   * Snapshots incluindo o histórico anterior ao período — use
   * `dataRangeWithComparisonFor` para montar a consulta.
   */
  snapshots: readonly FunnelSnapshot[]
  timing: PeriodTiming
  /** Data mais antiga que a fonte tem, de `firstDataDate(snapshots)`. */
  firstDataDate: string | null
  /** Ordem canônica dos canais. Vazio deriva da união das duas janelas. */
  channels?: readonly string[]
}

function unavailableResult(reason: ComparisonUnavailable): PeriodComparison {
  return {
    currentRange: null,
    previousRange: null,
    businessDays: 0,
    total: null,
    byChannel: [],
    unavailable: reason,
  }
}

function compare(
  channel: string,
  current: readonly FunnelSnapshot[],
  previous: readonly FunnelSnapshot[],
): ChannelComparison {
  const now = sumMetrics(current)
  const before = sumMetrics(previous)

  return {
    channel,
    metrics: METRICS.map((metric) => ({
      metric,
      current: now[metric],
      previous: before[metric],
      delta: now[metric] - before[metric],
      relative: relativeChange(now[metric], before[metric]),
    })),
  }
}

/**
 * Compara a janela realizada do período com a janela equivalente anterior.
 *
 * **A janela atual é a realizada, não o recorte inteiro.** Num mês de 21 dias
 * úteis com 10 decorridos, comparar contra os 21 dias úteis anteriores
 * compararia 10 dias de dado contra 21, e todo canal apareceria despencando pela
 * metade. É o erro mais provável desta feature, e é o que `businessDaysElapsed`
 * evita: ele já está ancorado na última data com dado, pela mesma razão da
 * decisão 0003.
 */
export function computePeriodComparison({
  snapshots,
  timing,
  firstDataDate,
  channels,
}: PeriodComparisonInput): PeriodComparison {
  if (timing.businessDaysElapsed === 0 || timing.lastDataDate === null) {
    return unavailableResult('sem-dado-no-periodo')
  }

  const elapsedEnd = timing.lastDataDate < timing.range.to ? timing.lastDataDate : timing.range.to
  const currentRange: DateRange = { from: timing.range.from, to: elapsedEnd }

  const previousRange = previousComparableRange(timing.range.from, timing.businessDaysElapsed)
  if (previousRange === null) return unavailableResult('historico-insuficiente')

  // Sem esta guarda, um recorte no começo do histórico leria a janela anterior
  // como zeros e produziria um crescimento fabricado. É o mesmo mecanismo que
  // `computeTiming` já usa para limitar a janela de tendência.
  if (firstDataDate !== null && previousRange.from < firstDataDate) {
    return unavailableResult('historico-insuficiente')
  }

  const current = applyFunnelQuery(snapshots, currentRange)
  const previous = applyFunnelQuery(snapshots, previousRange)

  // A união das duas janelas, e não só a atual: um canal que existia antes e
  // parou precisa aparecer como queda, em vez de desaparecer da comparação.
  const known = channels?.length
    ? [...channels]
    : [...new Set([...listChannels(current), ...listChannels(previous)])].sort()

  const ofChannel = (list: readonly FunnelSnapshot[], channel: string) =>
    list.filter((snapshot) => snapshot.channel === channel)

  return {
    currentRange,
    previousRange,
    businessDays: timing.businessDaysElapsed,
    total: compare('total', current, previous),
    byChannel: known.map((channel) =>
      compare(channel, ofChannel(current, channel), ofChannel(previous, channel)),
    ),
    unavailable: null,
  }
}

/** Comparação de uma métrica num canal. `null` quando não há o que comparar. */
export function findMetricComparison(
  comparison: PeriodComparison | null,
  channel: string,
  metric: Metric,
): MetricComparison | null {
  if (comparison === null || comparison.unavailable !== null) return null

  const scope =
    channel === 'total'
      ? comparison.total
      : (comparison.byChannel.find((entry) => entry.channel === channel) ?? null)

  return scope?.metrics.find((entry) => entry.metric === metric) ?? null
}
