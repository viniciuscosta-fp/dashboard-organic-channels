/**
 * Slots categóricos de cor, um por canal.
 *
 * Nomes de variável CSS, nunca hex: os valores vivem em `globals.css`, foram
 * validados para daltonismo e contraste nos dois modos, e trocar um exige
 * revalidar a paleta inteira.
 *
 * A cor segue o **canal**, não a posição dele em nenhum ranking: filtrar ou
 * reordenar não pode repintar os canais que sobraram. Por isso o slot é
 * escolhido pela posição na ordem canônica do catálogo, e não pela posição na
 * lista que está sendo renderizada.
 */
export const SERIES_COLORS = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
]

/**
 * Cor do canal, pela posição dele na ordem canônica.
 *
 * Canal fora da ordem — o que só acontece com canal que tem meta mas nem
 * cadastro nem dado no período — recebe cinza neutro em vez de tomar
 * emprestado o slot de outro canal. Cor duplicada mentiria sobre identidade;
 * cinza diz "este canal não tem slot", que é a verdade.
 */
export function seriesColorOf(order: readonly string[], channel: string): string {
  const index = order.indexOf(channel)
  if (index === -1) return 'var(--ink-muted)'

  return SERIES_COLORS[index % SERIES_COLORS.length]
}
