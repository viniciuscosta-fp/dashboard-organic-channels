import type { FunnelDataSource } from './funnel-repository'
import type { ChannelInfo } from './types'

/**
 * Contrato de leitura do cadastro de canais.
 *
 * Espelha `FunnelRepository` e `GoalRepository`. O cadastro existe para que a
 * taxonomia de canais — quais existem, como se chamam na tela e em que ordem
 * aparecem — seja decisão de marketing editável na planilha, e não um commit.
 */
export interface ChannelRepository {
  readonly source: FunnelDataSource
  getChannels(): Promise<ChannelInfo[]>
}
