import { addDays, monthOf, startOfWeek } from '../business-days'
import { formatDayMonth, formatMonth } from '../format'
import type { DateRange } from '../period'
import { listChannels } from './funnel-query'
import type { ChannelAdherence, GoalStatus, MetricAdherence } from './goal-math'
import { safeRatio } from './ratio'
import {
  FUNNEL_RATIO_DEFINITIONS,
  FUNNEL_STAGES,
  METRIC_LABELS,
  type ConversionRatio,
  type FunnelSnapshot,
  type FunnelStage,
  type FunnelTotals,
  type Metric,
} from './types'

/**
 * Modelos de visualização derivados dos snapshots.
 *
 * São funções puras e sem dependência de React de propósito: a transformação
 * roda no servidor, os componentes só recebem dados prontos, e cada regra de
 * agregação fica testável sem renderizar nada.
 */

export interface StageDatum {
  stage: FunnelStage
  label: string
  value: number
  /** Razão em relação à etapa anterior. `null` na primeira etapa. */
  conversionFromPrevious: number | null
}

export interface TrendDatum {
  /** Data ISO do período, mantida para ordenação e como chave de lista. */
  date: string
  /** Rótulo curto do eixo, ex.: `ago/26`. */
  label: string
  /** Uma entrada por canal, com a contagem de MQLs do período. */
  channels: Record<string, number>
}

/**
 * Monta as barras do funil, com a taxa de conversão entre etapas vizinhas.
 *
 * Recebe os totais de todas as métricas mas usa só as três etapas: receita não
 * é um estreitamento por onde as pessoas passam, e entrar aqui distorceria a
 * leitura do funil.
 */
export function buildStageData(totals: FunnelTotals): StageDatum[] {
  return FUNNEL_STAGES.map((stage, index) => {
    const previous = index === 0 ? undefined : FUNNEL_STAGES[index - 1]
    const previousValue = previous ? totals[previous] : undefined

    return {
      stage,
      label: METRIC_LABELS[stage],
      value: totals[stage],
      conversionFromPrevious:
        previousValue === undefined ? null : safeRatio(totals[stage], previousValue),
    }
  })
}

export type TrendGranularity = 'diaria' | 'semanal' | 'mensal'

/**
 * Escolhe o agrupamento do gráfico pelo tamanho do período.
 *
 * Com dado diário, um trimestre renderiza mais de noventa pontos por canal —
 * ilegível e ainda por cima ruidoso, já que o efeito de dia da semana domina a
 * leitura. Agrupar por semana ou mês devolve a tendência que o gráfico existe
 * para mostrar.
 */
export function trendGranularity(range: DateRange): TrendGranularity {
  const days =
    Math.round(
      (new Date(`${range.to}T00:00:00Z`).getTime() -
        new Date(`${range.from}T00:00:00Z`).getTime()) /
        86_400_000,
    ) + 1

  if (days <= 45) return 'diaria'
  if (days <= 180) return 'semanal'
  return 'mensal'
}

function bucketOf(date: string, granularity: TrendGranularity): string {
  if (granularity === 'diaria') return date
  if (granularity === 'semanal') return startOfWeek(date)
  return `${monthOf(date)}-01`
}

function bucketLabel(bucket: string, granularity: TrendGranularity): string {
  return granularity === 'mensal' ? formatMonth(bucket) : formatDayMonth(bucket)
}

/**
 * Série temporal de MQLs por canal, agrupada conforme a granularidade.
 *
 * Todo intervalo recebe uma entrada para cada canal conhecido, com zero quando
 * não há dado — sem isso a linha do canal ficaria com buracos e sugeriria
 * ausência de medição onde houve medição de valor zero.
 */
export function buildTrendData(
  snapshots: readonly FunnelSnapshot[],
  granularity: TrendGranularity = 'mensal',
): TrendDatum[] {
  const channels = listChannels(snapshots)
  const byBucket = new Map<string, Record<string, number>>()

  for (const snapshot of snapshots) {
    const bucket = bucketOf(snapshot.date, granularity)

    let entry = byBucket.get(bucket)
    if (!entry) {
      entry = Object.fromEntries(channels.map((channel) => [channel, 0]))
      byBucket.set(bucket, entry)
    }
    entry[snapshot.channel] += snapshot.mqls
  }

  return [...byBucket.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      label: bucketLabel(date, granularity),
      channels: values,
    }))
}

/**
 * Status em ordem de urgência: o que precisa de ação primeiro.
 *
 * `sem-meta` fica por último porque não é um alerta — é a ausência de régua.
 */
export const STATUS_SEVERITY: readonly GoalStatus[] = ['risco', 'atencao', 'no-ritmo', 'sem-meta']

function severityOf(status: GoalStatus): number {
  return STATUS_SEVERITY.indexOf(status)
}

/**
 * O status mais urgente entre as métricas de um canal.
 *
 * Métrica sem meta não puxa o canal para `sem-meta` se outra métrica tem régua:
 * o canal só é `sem-meta` quando nenhuma métrica dele tem meta.
 */
export function worstStatus(metrics: readonly MetricAdherence[]): GoalStatus {
  let worst: GoalStatus = 'sem-meta'

  for (const { status } of metrics) {
    if (status !== 'sem-meta' && (worst === 'sem-meta' || severityOf(status) < severityOf(worst))) {
      worst = status
    }
  }

  return worst
}

/**
 * Canais do mais urgente para o menos, com a ordem canônica como desempate.
 *
 * Com dez ou quinze canais a tabela de aderência passa de quarenta linhas; na
 * ordem do cadastro, o canal em risco podia estar no fim dela. O desempate pela
 * ordem canônica mantém a posição estável entre recargas.
 */
export function sortByUrgency(
  channels: readonly ChannelAdherence[],
  order: readonly string[],
): ChannelAdherence[] {
  const position = (channel: string) => {
    const index = order.indexOf(channel)
    return index === -1 ? Number.POSITIVE_INFINITY : index
  }

  return [...channels].sort(
    (a, b) =>
      severityOf(worstStatus(a.metrics)) - severityOf(worstStatus(b.metrics)) ||
      position(a.channel) - position(b.channel) ||
      a.channel.localeCompare(b.channel),
  )
}

/** Um canal dentro de um status, com as métricas que o puseram ali. */
export interface ChannelStatusEntry {
  channel: string
  /** Métricas no status do canal. Vazio para `sem-meta`. */
  metrics: Metric[]
}

export interface StatusGroup {
  status: GoalStatus
  channels: ChannelStatusEntry[]
}

/**
 * Quantos canais estão em cada status, e quais.
 *
 * Um canal entra uma vez só, no seu pior status. Devolve todos os status, mesmo
 * os vazios: "zero canais em risco" é a resposta que se quer ver, não um bloco
 * que some.
 */
export function summarizeChannelStatus(
  channels: readonly ChannelAdherence[],
  order: readonly string[],
): StatusGroup[] {
  const sorted = sortByUrgency(channels, order)

  return STATUS_SEVERITY.map((status) => ({
    status,
    channels: sorted
      .filter((entry) => worstStatus(entry.metrics) === status)
      .map((entry) => ({
        channel: entry.channel,
        metrics:
          status === 'sem-meta'
            ? []
            : entry.metrics.filter((metric) => metric.status === status).map((m) => m.metric),
      })),
  }))
}

/**
 * Quantas semanas a tabela de conversão exibe.
 *
 * Com `ultimos-90-dias` seriam treze colunas, ilegíveis em qualquer largura de
 * tela. Corta as mais antigas — e quem exibe **precisa dizer que cortou**, senão
 * a tabela lê como cobertura completa do período.
 */
export const MAX_SEMANAS_EXIBIDAS = 8

export interface ConversionWeek {
  /** Segunda-feira que abre a semana, em ISO. */
  date: string
  /** Rótulo curto da coluna, ex.: `22/06`. */
  label: string
  /** Razão por canal na semana. `null` quando o denominador é zero. */
  channels: Record<string, number | null>
  /** Denominador por canal: a base que sustenta cada razão. */
  bases: Record<string, number>
  /** Razão consolidada da semana, sobre a soma — não a média das razões. */
  total: number | null
  /** Denominador consolidado da semana. */
  totalBase: number
  /** `true` quando a semana não terminou, ou terminou depois do último dado. */
  partial: boolean
}

/**
 * Razão entre etapas, semana a semana, por canal.
 *
 * **As semanas são completas, de segunda a domingo, e não recortadas pelo
 * período.** Uma semana que começasse na quarta porque o período começa na
 * quarta teria três dias de base e mostraria uma queda que é puro truncamento.
 * Como a consulta já busca 21 dias corridos antes do período para a janela de
 * tendência (`dataRangeFor`), a primeira semana se completa com dias anteriores
 * ao recorte sem custo nenhum e sem uma segunda ida à fonte. Só a última semana
 * pode ficar incompleta, e ela vem marcada com `partial`.
 *
 * A política de nulo aqui é o **inverso** de `buildTrendData`, de propósito: lá,
 * intervalo sem linha vira zero, porque para volume o zero é a medição. Aqui,
 * denominador zero vira `null`, porque para razão o zero é uma afirmação
 * ("converteu nada") e ausência do que converter não é afirmação nenhuma. Não
 * "conserte" isso para ficar igual.
 */
export function buildConversionWeeks(
  snapshots: readonly FunnelSnapshot[],
  ratio: ConversionRatio,
  range: DateRange,
  lastDataDate: string | null,
  channels: readonly string[],
  limit: number = MAX_SEMANAS_EXIBIDAS,
): ConversionWeek[] {
  if (lastDataDate === null) return []

  // Semana futura não existe em fonte nenhuma, e semana depois do último dado
  // só teria zeros. O fim é o que vier primeiro.
  const end = lastDataDate < range.to ? lastDataDate : range.to
  if (end < range.from) return []

  const { numerator, denominator } = FUNNEL_RATIO_DEFINITIONS[ratio]
  const known = new Set(channels)

  const weeks: ConversionWeek[] = []
  const lastWeek = startOfWeek(end)

  for (let week = startOfWeek(range.from); week <= lastWeek; week = addDays(week, 7)) {
    const weekEnd = addDays(week, 6)

    const numerators = new Map<string, number>()
    const denominators = new Map<string, number>()

    for (const snapshot of snapshots) {
      if (snapshot.date < week || snapshot.date > weekEnd) continue
      if (!known.has(snapshot.channel)) continue

      numerators.set(
        snapshot.channel,
        (numerators.get(snapshot.channel) ?? 0) + snapshot[numerator],
      )
      denominators.set(
        snapshot.channel,
        (denominators.get(snapshot.channel) ?? 0) + snapshot[denominator],
      )
    }

    let totalNumerator = 0
    let totalDenominator = 0
    const byChannel: Record<string, number | null> = {}
    const bases: Record<string, number> = {}

    for (const channel of channels) {
      const channelNumerator = numerators.get(channel) ?? 0
      const channelDenominator = denominators.get(channel) ?? 0

      byChannel[channel] = safeRatio(channelNumerator, channelDenominator)
      bases[channel] = channelDenominator

      totalNumerator += channelNumerator
      totalDenominator += channelDenominator
    }

    weeks.push({
      date: week,
      label: formatDayMonth(week),
      channels: byChannel,
      bases,
      total: safeRatio(totalNumerator, totalDenominator),
      totalBase: totalDenominator,
      partial: weekEnd > end,
    })
  }

  return weeks.length > limit ? weeks.slice(weeks.length - limit) : weeks
}

export interface ConversionWeekDelta {
  /** Semana mais recente exibida. `null` quando não há duas semanas. */
  current: string | null
  /** Semana imediatamente anterior a ela. */
  previous: string | null
  /** Variação por canal, em pontos da razão. */
  channels: Record<string, number | null>
  /** Variação do consolidado. */
  total: number | null
  /** `true` quando a semana mais recente ainda não fechou. */
  provisional: boolean
}

/**
 * Variação da razão entre as duas últimas semanas exibidas.
 *
 * Compara as duas últimas **exibidas**, e não as duas últimas fechadas, para o
 * número da coluna casar com o que está na tela ao lado dele. Quando a mais
 * recente ainda não fechou, a variação sai marcada como provisória em vez de
 * escondida: metade de uma semana já diz para que lado a coisa está indo, desde
 * que quem lê saiba que é metade.
 *
 * Sem duas semanas não há variação — e isso é `null`, não zero.
 */
export function conversionWeekDeltas(weeks: readonly ConversionWeek[]): ConversionWeekDelta {
  const current = weeks.at(-1)
  const previous = weeks.at(-2)

  if (!current || !previous) {
    return {
      current: current?.date ?? null,
      previous: null,
      channels: {},
      total: null,
      provisional: false,
    }
  }

  const channels: Record<string, number | null> = {}
  for (const channel of Object.keys(current.channels)) {
    channels[channel] = safeDifference(current.channels[channel], previous.channels[channel])
  }

  return {
    current: current.date,
    previous: previous.date,
    channels,
    total: safeDifference(current.total, previous.total),
    provisional: current.partial,
  }
}

/** Diferença entre duas razões opcionais: falta de qualquer lado é `null`. */
function safeDifference(
  current: number | null,
  previous: number | null | undefined,
): number | null {
  if (current === null || previous === null || previous === undefined) return null
  return current - previous
}
