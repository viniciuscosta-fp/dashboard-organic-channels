import type { ChannelCatalog } from './data/channel-catalog'

/**
 * Slots categóricos de cor, um por **canal**, pela ordem canônica.
 *
 * Nomes de variável CSS, nunca hex: os valores vivem em `globals.css`, foram
 * validados para daltonismo e contraste nos dois modos, e trocar um exige
 * revalidar a paleta inteira.
 *
 * São só cinco slots: do sexto canal em diante, cinza. Por isso nenhum bloco da
 * tela identifica canal só por cor — todo ponto de cor vem com o nome ao lado.
 * A cor segue o canal e não o grupo porque grupos personalizados podem se
 * sobrepor: um canal em dois grupos não teria cor definida. Ver
 * docs/decisions/0010.
 */
export const SERIES_COLORS = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
] as const

/**
 * Cor de quem não tem slot: canal além do quinto, ou fora do catálogo.
 *
 * Nunca se recicla um slot. Cor repetida mentiria sobre identidade; cinza diz
 * "este canal não tem cor própria", que é a verdade.
 */
export const NEUTRAL_SERIES_COLOR = 'var(--ink-muted)'

/**
 * Cor de cada canal do catálogo, pela posição dele na ordem canônica.
 *
 * Calculada sobre o catálogo inteiro, nunca sobre a lista que está na tela:
 * escolher um grupo ou ordenar uma tabela não repinta nenhum canal.
 */
export function channelColors(catalog: ChannelCatalog): Record<string, string> {
  return Object.fromEntries(
    catalog.channels.map((entry, index) => [
      entry.channel,
      SERIES_COLORS[index] ?? NEUTRAL_SERIES_COLOR,
    ]),
  )
}

/** Cor de um canal, com o neutro para quem não está no mapa. */
export function colorOf(colors: Readonly<Record<string, string>>, channel: string): string {
  return colors[channel] ?? NEUTRAL_SERIES_COLOR
}
