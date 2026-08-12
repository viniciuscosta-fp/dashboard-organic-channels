import { FunnelDataError } from './funnel-repository'
import { funnelSnapshotSchema, type FunnelSnapshot } from './types'

/** Colunas obrigatórias do cabeçalho. Ver docs/data-contract.md. */
export const REQUIRED_COLUMNS = ['date', 'channel', 'mqls', 'opportunities', 'customers'] as const

type RequiredColumn = (typeof REQUIRED_COLUMNS)[number]
type ColumnIndex = Record<RequiredColumn, number>

/**
 * Converte as linhas cruas da planilha em snapshots validados.
 *
 * Vive separado de `sheets-funnel-repository.ts` — que carrega o cliente do
 * Google — para que a lógica de parsing seja testável sem rede nem credencial.
 *
 * O mapeamento é por **nome** de coluna, não por posição: alguém reordenar as
 * colunas na planilha não deve trocar silenciosamente MQLs por clientes.
 */
export function parseRows(rows: readonly string[][]): FunnelSnapshot[] {
  const [header, ...body] = rows

  if (!header) {
    throw new FunnelDataError(
      'A planilha está vazia — nem a linha de cabeçalho foi encontrada.',
      'sheets',
    )
  }

  const columns = buildColumnIndex(header)

  return body.flatMap((row, offset) => {
    // Linhas totalmente vazias no fim do intervalo são normais numa planilha.
    if (row.every((cell) => (cell ?? '').trim() === '')) return []

    const candidate = {
      date: row[columns.date]?.trim(),
      channel: row[columns.channel]?.trim(),
      mqls: row[columns.mqls]?.trim(),
      opportunities: row[columns.opportunities]?.trim(),
      customers: row[columns.customers]?.trim(),
    }

    const parsed = funnelSnapshotSchema.safeParse(candidate)

    if (!parsed.success) {
      // +2 porque a linha 1 é o cabeçalho e planilhas contam a partir de 1.
      const line = offset + 2
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')

      throw new FunnelDataError(`Linha ${line} da planilha é inválida (${details}).`, 'sheets')
    }

    return [parsed.data]
  })
}

function buildColumnIndex(header: readonly string[]): ColumnIndex {
  const normalized = header.map((cell) => (cell ?? '').trim().toLowerCase())
  const index = {} as ColumnIndex
  const missing: string[] = []

  for (const column of REQUIRED_COLUMNS) {
    const position = normalized.indexOf(column)
    if (position === -1) {
      missing.push(column)
      continue
    }
    index[column] = position
  }

  if (missing.length > 0) {
    throw new FunnelDataError(
      `Cabeçalho da planilha sem as colunas: ${missing.join(', ')}. Esperado: ${REQUIRED_COLUMNS.join(', ')}. Ver docs/data-contract.md.`,
      'sheets',
    )
  }

  return index
}
