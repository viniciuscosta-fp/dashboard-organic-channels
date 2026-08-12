import { buildColumnIndex, invalidRowError, isBlankRow } from './sheet-table'
import { funnelSnapshotSchema, type FunnelSnapshot } from './types'

/** Colunas obrigatórias da aba do funil. Ver docs/data-contract.md. */
export const REQUIRED_COLUMNS = ['date', 'channel', 'mqls', 'opportunities', 'customers'] as const

const SHEET_LABEL = 'funil'

/**
 * Converte as linhas cruas da aba do funil em snapshots validados.
 *
 * Vive separado de `sheets-funnel-repository.ts` — que carrega o cliente do
 * Google — para que a lógica de parsing seja testável sem rede nem credencial.
 */
export function parseRows(rows: readonly string[][]): FunnelSnapshot[] {
  const [header, ...body] = rows
  const columns = buildColumnIndex(header, REQUIRED_COLUMNS, SHEET_LABEL)

  return body.flatMap((row, offset) => {
    if (isBlankRow(row)) return []

    const parsed = funnelSnapshotSchema.safeParse({
      date: row[columns.date]?.trim(),
      channel: row[columns.channel]?.trim(),
      mqls: row[columns.mqls]?.trim(),
      opportunities: row[columns.opportunities]?.trim(),
      customers: row[columns.customers]?.trim(),
    })

    if (!parsed.success) throw invalidRowError(SHEET_LABEL, offset, parsed.error.issues)

    return [parsed.data]
  })
}
