import { FunnelDataError } from './funnel-repository'
import { buildColumnIndex, cellText, invalidRowError, isBlankRow } from './sheet-table'
import type { SheetRow } from './sheets-client'
import { funnelSnapshotSchema, type FunnelSnapshot } from './types'

/** Colunas obrigatórias da aba do funil. Ver docs/data-contract.md. */
export const REQUIRED_COLUMNS = [
  'date',
  'channel',
  'revenue',
  'mqls',
  'opportunities',
  'customers',
] as const

const SHEET_LABEL = 'funil'

/**
 * Converte as linhas cruas da aba do funil em snapshots validados.
 *
 * Vive separado de `sheets-funnel-repository.ts` — que carrega o cliente do
 * Google — para que a lógica de parsing seja testável sem rede nem credencial.
 */
export function parseRows(rows: readonly SheetRow[]): FunnelSnapshot[] {
  const [header, ...body] = rows
  const columns = buildColumnIndex(header, REQUIRED_COLUMNS, SHEET_LABEL)

  // Guarda contra o erro mais caro que esta aba pode sofrer. Todo cálculo do
  // dashboard soma as linhas do período: um dia e canal repetidos dobrariam o
  // número sem nenhum sinal de que algo está errado. É o que acontece quando a
  // coleta grava em modo append em vez de sobrescrever a linha do dia.
  const seen = new Map<string, number>()

  return body.flatMap((row, offset) => {
    if (isBlankRow(row)) return []

    const parsed = funnelSnapshotSchema.safeParse({
      date: cellText(row[columns.date]),
      channel: cellText(row[columns.channel]),
      revenue: cellText(row[columns.revenue]),
      mqls: cellText(row[columns.mqls]),
      opportunities: cellText(row[columns.opportunities]),
      customers: cellText(row[columns.customers]),
    })

    if (!parsed.success) throw invalidRowError(SHEET_LABEL, offset, parsed.error.issues)

    const key = `${parsed.data.date}|${parsed.data.channel}`
    const previous = seen.get(key)

    if (previous !== undefined) {
      throw new FunnelDataError(
        `Linhas ${previous} e ${offset + 2} da aba de ${SHEET_LABEL} repetem ${parsed.data.date} para o canal ${parsed.data.channel}. Cada dia e canal aceita uma linha só — a coleta precisa sobrescrever a linha existente. Ver docs/setup-planilha-e-apps-script.md.`,
        'sheets',
      )
    }

    // +2 porque a linha 1 é o cabeçalho e planilhas contam a partir de 1.
    seen.set(key, offset + 2)

    return [parsed.data]
  })
}
