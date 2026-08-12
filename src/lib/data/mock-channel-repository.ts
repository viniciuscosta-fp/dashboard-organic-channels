import type { ChannelRepository } from './channel-repository'
import type { ChannelInfo } from './types'

/**
 * Cadastro de exemplo com os cinco canais orgânicos acompanhados hoje.
 *
 * As chaves são exatamente as aceitas pelo webhook de métricas por canal, e os
 * rótulos são os que o time já usa nos relatórios.
 */
export const MOCK_CHANNELS: readonly ChannelInfo[] = [
  { channel: 'organic_site', label: 'Organic Search Site', order: 1 },
  { channel: 'blog_fluencypass', label: 'Organic Search (Blog - FP)', order: 2 },
  { channel: 'compare', label: 'Organic Search (Blog - Compare)', order: 3 },
  { channel: 'brand', label: 'Organic Search (Brand)', order: 4 },
  { channel: 'ai_referrals', label: 'Referências de IA', order: 5 },
]

export class MockChannelRepository implements ChannelRepository {
  readonly source = 'mock' as const

  async getChannels(): Promise<ChannelInfo[]> {
    return [...MOCK_CHANNELS]
  }
}
