import { buildColumnIndex, cellText, invalidRowError, isBlankRow } from './sheet-table'
import type { SheetRow } from './sheets-client'
import { monthlyGoalSchema, type MonthlyGoal } from './types'

/** Colunas obrigatórias da aba de metas. Ver docs/data-contract.md. */
export const REQUIRED_GOAL_COLUMNS = ['month', 'channel', 'metric', 'target'] as const

const SHEET_LABEL = 'metas'

/**
 * Converte as linhas cruas da aba de metas em metas mensais validadas.
 *
 * Puro e sem rede, como o parser do funil. `metric` é validado contra as
 * métricas conhecidas: uma métrica escrita errado na planilha vira erro com o
 * número da linha, e não uma meta que some silenciosamente do dashboard.
 */
export function parseGoalRows(rows: readonly SheetRow[]): MonthlyGoal[] {
  const [header, ...body] = rows
  const columns = buildColumnIndex(header, REQUIRED_GOAL_COLUMNS, SHEET_LABEL)

  return body.flatMap((row, offset) => {
    if (isBlankRow(row)) return []

    const parsed = monthlyGoalSchema.safeParse({
      month: cellText(row[columns.month]),
      channel: cellText(row[columns.channel]),
      metric: cellText(row[columns.metric]).toLowerCase(),
      target: cellText(row[columns.target]),
    })

    if (!parsed.success) throw invalidRowError(SHEET_LABEL, offset, parsed.error.issues)

    return [parsed.data]
  })
}
