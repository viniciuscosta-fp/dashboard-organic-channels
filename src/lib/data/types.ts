import { z } from 'zod'

/**
 * Etapas do funil rastreadas na V1.
 *
 * A ordem do array é a ordem do funil e é usada para renderizar o gráfico —
 * não reordene sem ajustar `docs/data-contract.md`.
 */
export const FUNNEL_STAGES = ['mqls', 'opportunities', 'customers'] as const

export type FunnelStage = (typeof FUNNEL_STAGES)[number]

export function isFunnelStage(value: unknown): value is FunnelStage {
  return typeof value === 'string' && (FUNNEL_STAGES as readonly string[]).includes(value)
}

export const FUNNEL_STAGE_LABELS: Record<FunnelStage, string> = {
  mqls: 'MQLs',
  opportunities: 'Oportunidades',
  customers: 'Clientes',
}

/**
 * Uma linha agregada do funil: contagens de um canal num período.
 *
 * Contém apenas números agregados. Dados em nível de lead (nome, e-mail,
 * telefone) nunca entram aqui — ver docs/decisions/0001.
 */
export interface FunnelSnapshot {
  /** Data de referência do período, em ISO `YYYY-MM-DD`. */
  date: string
  /** Canal de origem, ex.: `organic-search`, `direct`, `referral`. */
  channel: string
  mqls: number
  opportunities: number
  customers: number
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data deve estar em ISO YYYY-MM-DD')

const count = z.coerce
  .number()
  .int('contagem deve ser inteira')
  .min(0, 'contagem não pode ser negativa')

/**
 * Valida uma linha vinda de fonte externa (planilha, API).
 *
 * Usa coerção porque o Google Sheets devolve toda célula como string.
 */
export const funnelSnapshotSchema = z.object({
  date: isoDate,
  channel: z.string().min(1, 'canal não pode ser vazio'),
  mqls: count,
  opportunities: count,
  customers: count,
}) satisfies z.ZodType<FunnelSnapshot>

/** Filtros aplicáveis na leitura do funil. */
export interface FunnelQuery {
  /** Data inicial inclusiva, ISO `YYYY-MM-DD`. */
  from?: string
  /** Data final inclusiva, ISO `YYYY-MM-DD`. */
  to?: string
  /** Lista de canais a manter. Vazio ou ausente mantém todos. */
  channels?: string[]
}

/** Totais consolidados de um conjunto de snapshots. */
export type FunnelTotals = Record<FunnelStage, number>

/**
 * Meta **mensal** de uma etapa num canal.
 *
 * A meta é sempre cadastrada por mês cheio. O rateio para o período que o
 * usuário selecionou acontece em `src/lib/data/goal-math.ts`, por dias úteis.
 */
export interface MonthlyGoal {
  /** Mês de referência, ISO `AAAA-MM`. */
  month: string
  channel: string
  stage: FunnelStage
  target: number
}

const isoMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'mês deve estar em ISO AAAA-MM')

export const monthlyGoalSchema = z.object({
  month: isoMonth,
  channel: z.string().min(1, 'canal não pode ser vazio'),
  stage: z.enum(FUNNEL_STAGES),
  target: count,
}) satisfies z.ZodType<MonthlyGoal>
