import { FunnelDataError } from './funnel-repository'
import {
  buildColumnIndex,
  cellText,
  findOptionalColumn,
  invalidRowError,
  isBlankRow,
} from './sheet-table'
import type { SheetRow } from './sheets-client'
import { channelInfoSchema, type ChannelInfo } from './types'

/** Colunas obrigatórias da aba de canais. Ver docs/data-contract.md. */
export const REQUIRED_CHANNEL_COLUMNS = ['channel', 'label', 'order'] as const

/**
 * Coluna opcional de grupo. Opcional para que a planilha anterior a ela, e o
 * `CHANNELS_SHEET_RANGE` antigo (`canais!A:C`), continuem funcionando.
 */
export const OPTIONAL_GROUP_COLUMN = 'group'

const SHEET_LABEL = 'canais'

/**
 * Converte as linhas cruas da aba de canais em cadastro validado.
 *
 * Devolve já ordenado por `order`, com desempate alfabético pela chave para
 * que dois canais com a mesma ordem não fiquem trocando de lugar entre
 * renderizações.
 */
export function parseChannelRows(rows: readonly SheetRow[]): ChannelInfo[] {
  const [header, ...body] = rows
  const columns = buildColumnIndex(header, REQUIRED_CHANNEL_COLUMNS, SHEET_LABEL)
  // `buildColumnIndex` já recusou o cabeçalho ausente; o `?? []` só informa o tipo.
  const groupColumn = findOptionalColumn(header ?? [], OPTIONAL_GROUP_COLUMN)

  const seen = new Map<string, number>()

  const channels = body.flatMap((row, offset) => {
    if (isBlankRow(row)) return []

    // Célula de grupo vazia é canal sem grupo, não erro: a coluna é opcional
    // linha a linha também.
    const group = groupColumn === undefined ? '' : cellText(row[groupColumn])

    const parsed = channelInfoSchema.safeParse({
      channel: cellText(row[columns.channel]),
      label: cellText(row[columns.label]),
      order: cellText(row[columns.order]),
      ...(group === '' ? {} : { group }),
    })

    if (!parsed.success) throw invalidRowError(SHEET_LABEL, offset, parsed.error.issues)

    const previous = seen.get(parsed.data.channel)

    if (previous !== undefined) {
      throw new FunnelDataError(
        `Linhas ${previous} e ${offset + 2} da aba de ${SHEET_LABEL} cadastram o canal ${parsed.data.channel} duas vezes.`,
        'sheets',
      )
    }

    seen.set(parsed.data.channel, offset + 2)

    return [parsed.data]
  })

  return channels.sort((a, b) => a.order - b.order || a.channel.localeCompare(b.channel))
}
