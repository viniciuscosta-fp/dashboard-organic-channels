import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { getEnv } from '../env'
import type { FunnelRepository } from './funnel-repository'
import { MockFunnelRepository } from './mock-funnel-repository'
import type { FunnelQuery, FunnelSnapshot } from './types'

/**
 * Tag de cache do funil.
 *
 * Um endpoint de revalidação sob demanda pode chamar `revalidateTag` com esta
 * tag para que o n8n derrube o cache logo após escrever na planilha, em vez de
 * esperar a janela de tempo expirar.
 */
export const FUNNEL_CACHE_TAG = 'funnel'

let repository: FunnelRepository | undefined

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
