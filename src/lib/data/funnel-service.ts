import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { getEnv } from '../env'
import type { GoalRepository } from './goal-repository'
import type { FunnelRepository } from './funnel-repository'
import { MockFunnelRepository } from './mock-funnel-repository'
import { MockGoalRepository } from './mock-goal-repository'
import type { FunnelQuery, FunnelSnapshot, MonthlyGoal } from './types'

/**
 * Tags de cache.
 *
 * Um endpoint de revalidação sob demanda pode chamar `revalidateTag` com estas
 * tags para que o n8n derrube o cache logo após escrever na planilha, em vez de
 * esperar a janela de tempo expirar. Metas e funil têm tags separadas porque
 * mudam em ritmos diferentes: meta muda uma vez por mês.
 */
export const FUNNEL_CACHE_TAG = 'funnel'
export const GOALS_CACHE_TAG = 'goals'

let repository: FunnelRepository | undefined
let goalRepository: GoalRepository | undefined

/**
 * Escolhe a implementação de `FunnelRepository` conforme `DATA_SOURCE`.
 *
 * O import do repositório de Sheets é dinâmico para que o caminho de
 * desenvolvimento nunca carregue o cliente do Google — `npm run dev` sobe sem
 * nenhuma credencial configurada.
 */
export async function getFunnelRepository(): Promise<FunnelRepository> {
  if (repository) return repository

  const env = getEnv()

  if (env.DATA_SOURCE === 'sheets') {
    const { SheetsFunnelRepository } = await import('./sheets-funnel-repository')
    repository = new SheetsFunnelRepository()
  } else {
    repository = new MockFunnelRepository()
  }

  return repository
}

/** Fonte de dados ativa, sem tocar na fonte em si. Usada em rótulos e diagnóstico. */
export function getFunnelSource() {
  return getEnv().DATA_SOURCE
}

/**
 * Ponto de entrada da UI para ler o funil.
 *
 * Cacheado por hora: o n8n atualiza a planilha no máximo algumas vezes por
 * dia, e a API do Sheets é lenta demais (~1s) para ser chamada a cada
 * renderização.
 */
export async function getFunnelSnapshots(query?: FunnelQuery): Promise<FunnelSnapshot[]> {
  'use cache'
  cacheLife('hours')
  cacheTag(FUNNEL_CACHE_TAG)

  const source = await getFunnelRepository()
  return source.getSnapshots(query)
}

/** Escolhe a implementação de `GoalRepository`, pelo mesmo `DATA_SOURCE`. */
export async function getGoalRepository(): Promise<GoalRepository> {
  if (goalRepository) return goalRepository

  if (getEnv().DATA_SOURCE === 'sheets') {
    const { SheetsGoalRepository } = await import('./sheets-goal-repository')
    goalRepository = new SheetsGoalRepository()
  } else {
    goalRepository = new MockGoalRepository()
  }

  return goalRepository
}

/**
 * Ponto de entrada da UI para ler as metas.
 *
 * Cacheado por um dia: meta é decisão mensal, não dado que flutua. A tag
 * própria permite derrubar só as metas quando alguém corrigir a planilha.
 */
export async function getGoals(): Promise<MonthlyGoal[]> {
  'use cache'
  cacheLife('days')
  cacheTag(GOALS_CACHE_TAG)

  const source = await getGoalRepository()
  return source.getGoals()
}
