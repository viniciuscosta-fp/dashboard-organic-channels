import type { ChannelCatalog } from './data/channel-catalog'

/**
 * Slots categóricos de cor, um por **grupo** de canais.
 *
 * Nomes de variável CSS, nunca hex: os valores vivem em `globals.css`, foram
 * validados para daltonismo e contraste nos dois modos, e trocar um exige
 * revalidar a paleta inteira.
 *
 * A cor diz a família do canal; o nome diz qual canal é. Com dez ou quinze
 * canais não existe paleta categórica que se leia com segurança, então nenhum
 * bloco da tela identifica canal só por cor — todo ponto de cor vem com rótulo.
 * Ver docs/decisions/0009.
 */
export const SERIES_COLORS = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
] as const

/**
 * Cor de quem não tem slot: grupo além do quinto, ou canal fora do catálogo.
 *
 * Nunca se recicla um slot. Cor repetida mentiria sobre identidade; cinza diz
 * "este grupo não tem cor própria", que é a verdade.
 */
export const NEUTRAL_SERIES_COLOR = 'var(--ink-muted)'

/**
 * Cor de cada canal do catálogo, pelo slot do seu grupo.
 *
 * O slot é a posição do grupo na ordem canônica, não a posição do canal em
 * ranking nenhum: filtrar ou ordenar uma tabela não repinta nada.
 */
export function channelColors(catalog: ChannelCatalog): Record<string, string> {
  const slotOf = new Map(catalog.groups.map((group, index) => [group.key, index]))

  return Object.fromEntries(
    catalog.channels.map((entry) => {
      const slot = slotOf.get(entry.group.key) ?? Number.POSITIVE_INFINITY
      return [entry.channel, SERIES_COLORS[slot] ?? NEUTRAL_SERIES_COLOR]
    }),
  )
}

/** Cor de um canal, com o neutro para quem não está no mapa. */
export function colorOf(colors: Readonly<Record<string, string>>, channel: string): string {
  return colors[channel] ?? NEUTRAL_SERIES_COLOR
}
