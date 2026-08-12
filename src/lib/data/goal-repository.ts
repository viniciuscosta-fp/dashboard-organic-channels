import type { FunnelDataSource } from './funnel-repository'
import type { MonthlyGoal } from './types'

/**
 * Contrato de leitura das metas.
 *
 * Espelha `FunnelRepository` de propósito: quando o funil migrar de planilha
 * para banco, as metas migram pelo mesmo caminho e pelas mesmas regras.
 *
 * Não recebe filtro de período. A aba de metas é minúscula — doze meses de três
 * canais em três etapas dão pouco mais de cem linhas por ano — e filtrar em
 * memória custa menos que uma requisição a mais.
 */
export interface GoalRepository {
  readonly source: FunnelDataSource
  getGoals(): Promise<MonthlyGoal[]>
}
