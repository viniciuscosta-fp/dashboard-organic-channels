import { formatMonth } from '../format'
import { listChannels, sumFunnelStages } from './funnel-query'
import {
  FUNNEL_STAGES,
  FUNNEL_STAGE_LABELS,
  type FunnelSnapshot,
  type FunnelStage,
  type FunnelTotals,
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

export interface ChannelRow extends FunnelTotals {
  channel: string
}

/** Monta as barras do funil, com a taxa de conversão entre etapas vizinhas. */
export function buildStageData(totals: FunnelTotals): StageDatum[] {
  return FUNNEL_STAGES.map((stage, index) => {
    const previous = index === 0 ? undefined : FUNNEL_STAGES[index - 1]
    const previousValue = previous ? totals[previous] : undefined

    return {
      stage,
      label: FUNNEL_STAGE_LABELS[stage],
      value: totals[stage],
      conversionFromPrevious:
        previousValue === undefined || previousValue === 0 ? null : totals[stage] / previousValue,
    }
  })
}

/**
 * Série temporal de MQLs por canal.
 *
 * Todo período recebe uma entrada para cada canal conhecido, com zero quando
 * não há dado — sem isso a linha do canal ficaria com buracos e sugeriria
 * ausência de medição onde houve medição de valor zero.
 */
export function buildTrendData(snapshots: readonly FunnelSnapshot[]): TrendDatum[] {
  const channels = listChannels(snapshots)
  const byDate = new Map<string, Record<string, number>>()

  for (const snapshot of snapshots) {
    let entry = byDate.get(snapshot.date)
    if (!entry) {
      entry = Object.fromEntries(channels.map((channel) => [channel, 0]))
      byDate.set(snapshot.date, entry)
    }
    entry[snapshot.channel] += snapshot.mqls
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date, label: formatMonth(date), channels: values }))
}

/** Consolida os totais de cada canal, do maior para o menor volume de MQLs. */
export function buildChannelRows(snapshots: readonly FunnelSnapshot[]): ChannelRow[] {
  return listChannels(snapshots)
    .map((channel) => ({
      channel,
      ...sumFunnelStages(snapshots.filter((snapshot) => snapshot.channel === channel)),
    }))
    .sort((a, b) => b.mqls - a.mqls)
}
