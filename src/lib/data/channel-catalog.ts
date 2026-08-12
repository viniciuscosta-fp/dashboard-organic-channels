import type { ChannelInfo } from './types'

/** Um canal pronto para a tela: chave, nome exibido e se está cadastrado. */
export interface ResolvedChannel {
  channel: string
  label: string
  /** `false` quando o canal apareceu no funil mas não está na aba `canais`. */
  registered: boolean
}

export interface ChannelCatalog {
  channels: ResolvedChannel[]
  /** Chaves vistas no funil e ausentes do cadastro, para avisar na interface. */
  unregistered: string[]
}

/**
 * Cruza o cadastro de canais com o que apareceu nos dados.
 *
 * Canal cadastrado sem dado no período **aparece zerado**: estar em zero é
 * informação, e some-lo esconderia justamente o canal que precisa de atenção.
 *
 * Canal com dado e sem cadastro também aparece, com a chave crua como rótulo e
 * registrado em `unregistered` — mesmo princípio do mês sem meta: a ausência
 * vira aviso visível, nunca dado descartado em silêncio.
 */
export function resolveChannels(
  registered: readonly ChannelInfo[],
  seenInData: readonly string[],
): ChannelCatalog {
  const byKey = new Map(registered.map((info) => [info.channel, info]))

  const unregistered = [...new Set(seenInData)].filter((key) => !byKey.has(key)).sort()

  const channels: ResolvedChannel[] = [
    ...registered.map((info) => ({
      channel: info.channel,
      label: info.label,
      registered: true,
    })),
    ...unregistered.map((channel) => ({ channel, label: channel, registered: false })),
  ]

  return { channels, unregistered }
}

/** Consulta rápida de rótulo, com a chave crua como reserva. */
export function labelOf(catalog: ChannelCatalog, channel: string): string {
  return catalog.channels.find((entry) => entry.channel === channel)?.label ?? channel
}
