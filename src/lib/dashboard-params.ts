import { isConversionRatio, isMetric, type ConversionRatio, type Metric } from './data/types'
import {
  parsePeriod,
  periodSearchParams,
  single,
  type DateRange,
  type PeriodPresetId,
  type SearchParamValue,
} from './period'

/**
 * Estado do dashboard que mora na URL.
 *
 * São três eixos independentes — período, métrica do burn-up e transição do
 * funil — e cada controle da tela governa um deles. O problema que este módulo
 * resolve é o de preservar os outros dois: um controle que esquece de repassar
 * um parâmetro reseta silenciosamente uma escolha do usuário, e essa é a
 * regressão mais fácil de introduzir e mais difícil de notar.
 *
 * `parsePeriod` continua sendo a autoridade sobre período; aqui ele é composto,
 * não substituído.
 */

export const DEFAULT_METRIC: Metric = 'revenue'

/** A primeira transição do funil, e a de base mais larga. */
export const DEFAULT_RATIO: ConversionRatio = 'mql-to-opportunity'

export interface DashboardParams {
  range: DateRange
  /** `null` quando o período em uso é um intervalo personalizado. */
  presetId: PeriodPresetId | null
  metric: Metric
  ratio: ConversionRatio
  /**
   * Canal em foco, ou `null` para o consolidado.
   *
   * Sai daqui **cru**: a lista de canais válidos vem do dado, que só é buscado
   * depois. Quem fecha a validação é `resolveChannelParam`, na rota.
   */
  channel: string | null
}

/** Qual eixo um controle governa — e portanto omite dos próprios links. */
export type DashboardControl = 'periodo' | 'metrica' | 'taxa' | 'canal'

/**
 * Lê o estado do dashboard a partir dos parâmetros da URL.
 *
 * Entrada inválida cai no padrão em silêncio, como `parsePeriod` já faz: um link
 * colado errado num chat não pode quebrar o dashboard de quem abriu.
 */
export function parseDashboardParams(
  searchParams: Record<string, SearchParamValue>,
  today: string,
): DashboardParams {
  const { range, presetId } = parsePeriod(searchParams, today)

  const metric = single(searchParams.metrica)
  const ratio = single(searchParams.taxa)
  const channel = single(searchParams.canal)?.trim()

  return {
    range,
    presetId,
    metric: isMetric(metric) ? metric : DEFAULT_METRIC,
    ratio: isConversionRatio(ratio) ? ratio : DEFAULT_RATIO,
    channel: channel ? channel : null,
  }
}

/**
 * Fecha a validação do canal contra os canais que realmente existem.
 *
 * Chave desconhecida vira consolidado em silêncio, e não erro: a lista de canais
 * muda com uma linha na planilha, então um link compartilhado semanas atrás pode
 * apontar para um canal que não existe mais. Cair no consolidado mostra o
 * dashboard; derrubar a página não mostra nada.
 */
export function resolveChannelParam(
  channel: string | null,
  known: readonly string[],
): string | null {
  return channel !== null && known.includes(channel) ? channel : null
}

/**
 * Parâmetros de URL que reproduzem o estado atual, menos o que o controle
 * governa.
 *
 * Omitir `periodo` derruba tanto o preset quanto o intervalo personalizado — são
 * duas formas de expressar o mesmo eixo, e deixar uma das duas para trás faria o
 * período voltar sozinho.
 */
export function dashboardSearchParams(
  params: DashboardParams,
  omit: readonly DashboardControl[] = [],
): Record<string, string> {
  const excluded = new Set(omit)
  const query: Record<string, string> = {}

  if (!excluded.has('periodo')) {
    Object.assign(query, periodSearchParams(params.presetId ?? params.range))
  }
  if (!excluded.has('metrica')) query.metrica = params.metric
  if (!excluded.has('taxa')) query.taxa = params.ratio

  // Consolidado é a ausência do parâmetro, não um valor especial: assim a URL
  // do estado padrão é a URL limpa.
  if (!excluded.has('canal') && params.channel !== null) query.canal = params.channel

  return query
}
