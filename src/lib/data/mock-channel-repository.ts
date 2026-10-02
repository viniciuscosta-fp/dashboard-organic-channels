import type { ChannelRepository } from './channel-repository'
import type { ChannelInfo } from './types'

/**
 * Cadastro de exemplo com dez canais em três grupos.
 *
 * Os cinco do grupo `Orgânico` são os canais que o dashboard acompanha desde a
 * V1, com as chaves aceitas pelo webhook de métricas por canal. Os outros cinco
 * são **fictícios**: existem para o modo mock exercitar o layout com mais
 * canais e com agrupamento. A taxonomia real vive na aba `canais` da planilha.
 *
 * A ordem é intercalada de propósito (um canal pago no meio dos orgânicos): é o
 * que verifica que a tela agrupa pelo grupo, e não pela ordem bruta.
 */
export const MOCK_CHANNELS: readonly ChannelInfo[] = [
  { channel: 'organic_site', label: 'Organic Search Site', order: 1, group: 'Orgânico' },
  { channel: 'blog_fluencypass', label: 'Organic Search (Blog - FP)', order: 2, group: 'Orgânico' },
  { channel: 'compare', label: 'Organic Search (Blog - Compare)', order: 3, group: 'Orgânico' },
  { channel: 'paid_search', label: 'Busca paga', order: 4, group: 'Pago' },
  { channel: 'brand', label: 'Organic Search (Brand)', order: 5, group: 'Orgânico' },
  { channel: 'ai_referrals', label: 'Referências de IA', order: 6, group: 'Orgânico' },
  { channel: 'paid_social', label: 'Social pago', order: 7, group: 'Pago' },
  { channel: 'paid_display', label: 'Display', order: 8, group: 'Pago' },
  { channel: 'social_instagram', label: 'Instagram (orgânico)', order: 9, group: 'Social' },
  { channel: 'social_youtube', label: 'YouTube (orgânico)', order: 10, group: 'Social' },
]

export class MockChannelRepository implements ChannelRepository {
  readonly source = 'mock' as const

  async getChannels(): Promise<ChannelInfo[]> {
    return [...MOCK_CHANNELS]
  }
}
