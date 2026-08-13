import { z } from 'zod'

/**
 * Métricas acompanhadas pelo dashboard.
 *
 * Toda métrica tem KPI, meta, projeção e status. A ordem do array é a ordem em
 * que aparecem na tela.
 */
export const METRICS = ['revenue', 'mqls', 'opportunities', 'customers'] as const

export type Metric = (typeof METRICS)[number]

export function isMetric(value: unknown): value is Metric {
  return typeof value === 'string' && (METRICS as readonly string[]).includes(value)
}

/**
 * Etapas do funil: o subconjunto de métricas que representa estreitamento.
 *
 * Receita fica de fora de propósito — ela é valor, não uma etapa por onde as
 * pessoas passam, e num gráfico de funil só distorceria a leitura. A ordem é a
 * ordem do funil; não reordene sem ajustar `docs/data-contract.md`.
 */
export const FUNNEL_STAGES = ['mqls', 'opportunities', 'customers'] as const

export type FunnelStage = (typeof FUNNEL_STAGES)[number]

export const METRIC_LABELS: Record<Metric, string> = {
  revenue: 'Receita',
  mqls: 'MQLs',
  opportunities: 'Oportunidades',
  customers: 'Clientes',
}

/** Métricas em dinheiro precisam de formatação e validação próprias. */
export function isCurrencyMetric(metric: Metric): boolean {
  return metric === 'revenue'
}

/**
 * Razões entre etapas do funil.
 *
 * **Não são conversões de coorte.** O modelo conta eventos por dia — MQLs
 * criados no dia, oportunidades criadas no dia — sem vínculo entre um MQL e a
 * oportunidade que ele virou. `Σoportunidades / Σmqls` é a razão entre dois
 * fluxos medidos na mesma janela, o que é coisa diferente da probabilidade de um
 * MQL virar oportunidade. Daí o nome `ratio` em vez de `conversionRate`, e os
 * rótulos dizendo "no período". Ver `docs/decisions/0005`.
 *
 * A ordem do array é a ordem em que aparecem na tela.
 */
export const CONVERSION_RATIOS = [
  'mql-to-opportunity',
  'opportunity-to-customer',
  'mql-to-customer',
] as const

export type ConversionRatio = (typeof CONVERSION_RATIOS)[number]

export function isConversionRatio(value: unknown): value is ConversionRatio {
  return typeof value === 'string' && (CONVERSION_RATIOS as readonly string[]).includes(value)
}

export interface ConversionRatioDefinition {
  numerator: FunnelStage
  denominator: FunnelStage
  /** Nome completo, para título e legenda. */
  label: string
  /** Versão curta, para aba e cabeçalho de coluna. */
  shortLabel: string
}

/**
 * O par de métricas de cada razão.
 *
 * `mql-to-customer` é `customers / mqls` **direto**, e não o produto das duas
 * etapas anteriores. Algebricamente daria no mesmo enquanto houver oportunidade,
 * mas o dado real permite `opportunities = 0` com `customers > 0` — defasagem de
 * registro, ou cliente fechado sem oportunidade cadastrada. Nesse caso o produto
 * é indefinido e a divisão direta continua válida.
 */
export const CONVERSION_RATIO_DEFINITIONS: Record<ConversionRatio, ConversionRatioDefinition> = {
  'mql-to-opportunity': {
    numerator: 'opportunities',
    denominator: 'mqls',
    label: 'MQL → Oportunidade',
    shortLabel: 'MQL→Opp',
  },
  'opportunity-to-customer': {
    numerator: 'customers',
    denominator: 'opportunities',
    label: 'Oportunidade → Cliente',
    shortLabel: 'Opp→Cli',
  },
  'mql-to-customer': {
    numerator: 'customers',
    denominator: 'mqls',
    label: 'MQL → Cliente',
    shortLabel: 'MQL→Cli',
  },
}

/**
 * Um dia de um canal: as quatro métricas daquele dia.
 *
 * Contém apenas números agregados. Dados em nível de lead (nome, e-mail,
 * telefone) nunca entram aqui — ver docs/decisions/0001.
 */
export interface FunnelSnapshot {
  /** O dia, em ISO `AAAA-MM-DD`. */
  date: string
  /** Chave do canal, ex.: `organic_site`, `blog_fluencypass`. */
  channel: string
  /** Receita do dia, em reais. Decimal. */
  revenue: number
  mqls: number
  opportunities: number
  customers: number
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data deve estar em ISO AAAA-MM-DD')

const isoMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'mês deve estar em ISO AAAA-MM')

const count = z.coerce
  .number({ error: 'contagem inválida: a célula precisa conter um número' })
  .int('contagem deve ser inteira')
  .min(0, 'contagem não pode ser negativa')

/**
 * Valor monetário.
 *
 * Aceita centavos, ao contrário das contagens.
 *
 * A mensagem própria na coerção existe para o caso mais provável de erro: uma
 * célula lida como texto formatado (`R$ 3.200,50`) vira `NaN`, e o erro padrão
 * do Zod — "expected number, received NaN" — não diria a quem lê o que fazer.
 */
const money = z.coerce
  .number({
    error: 'valor monetário inválido: a célula precisa ser número, não texto formatado',
  })
  .finite('valor monetário inválido')
  .min(0, 'valor não pode ser negativo')

/**
 * Valida uma linha vinda de fonte externa.
 *
 * Usa coerção porque a planilha pode devolver a célula como texto ou como
 * número, conforme o tipo que ela tem lá.
 */
export const funnelSnapshotSchema = z.object({
  date: isoDate,
  channel: z.string().min(1, 'canal não pode ser vazio'),
  revenue: money,
  mqls: count,
  opportunities: count,
  customers: count,
}) satisfies z.ZodType<FunnelSnapshot>

/** Filtros aplicáveis na leitura do funil. */
export interface FunnelQuery {
  /** Data inicial inclusiva, ISO `AAAA-MM-DD`. */
  from?: string
  /** Data final inclusiva, ISO `AAAA-MM-DD`. */
  to?: string
  /** Lista de canais a manter. Vazio ou ausente mantém todos. */
  channels?: string[]
}

/** Totais consolidados de um conjunto de snapshots. */
export type FunnelTotals = Record<Metric, number>

/**
 * Meta **mensal** de uma métrica num canal.
 *
 * A meta é sempre cadastrada por mês cheio. O rateio para o período que o
 * usuário selecionou acontece em `src/lib/data/goal-math.ts`, por dias úteis.
 */
export interface MonthlyGoal {
  /** Mês de referência, ISO `AAAA-MM`. */
  month: string
  channel: string
  metric: Metric
  target: number
}

export const monthlyGoalSchema = z.object({
  month: isoMonth,
  channel: z.string().min(1, 'canal não pode ser vazio'),
  metric: z.enum(METRICS),
  // Metas de contagem também aceitam decimal aqui: quem valida a natureza da
  // métrica é a planilha, e uma meta de receita com centavos é legítima.
  target: money,
}) satisfies z.ZodType<MonthlyGoal>

/**
 * Um canal cadastrado, com o nome que o time usa e a ordem na tela.
 *
 * Vive na aba `canais` para que incluir um canal novo seja uma linha na
 * planilha, e não um commit — a taxonomia de canais é decisão de marketing.
 */
export interface ChannelInfo {
  /** Chave usada na aba do funil e enviada ao webhook. */
  channel: string
  /** Nome exibido no dashboard. */
  label: string
  /** Posição na tela; menor aparece antes. */
  order: number
}

export const channelInfoSchema = z.object({
  channel: z.string().min(1, 'canal não pode ser vazio'),
  label: z.string().min(1, 'rótulo não pode ser vazio'),
  order: z.coerce.number().int('ordem deve ser inteira'),
}) satisfies z.ZodType<ChannelInfo>
