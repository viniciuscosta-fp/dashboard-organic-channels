import { buildColumnIndex, invalidRowError, isBlankRow } from './sheet-table'
import { monthlyGoalSchema, type MonthlyGoal } from './types'

/** Colunas obrigatórias da aba de metas. Ver docs/data-contract.md. */
export const REQUIRED_GOAL_COLUMNS = ['month', 'channel', 'stage', 'target'] as const

const SHEET_LABEL = 'metas'

/**
 * Converte as linhas cruas da aba de metas em metas mensais validadas.
 *
 * Puro e sem rede, como o parser do funil. `stage` é validado contra as etapas
 * conhecidas: uma etapa escrita errado na planilha vira erro com o número da
 * linha, e não uma meta que some silenciosamente do dashboard.
 */
export function parseGoalRows(rows: readonly string[][]): MonthlyGoal[] {
  const [header, ...body] = rows
  const columns = buildColumnIndex(header, REQUIRED_GOAL_COLUMNS, SHEET_LABEL)

  return body.flatMap((row, offset) => {
    if (isBlankRow(row)) return []

    const parsed = monthlyGoalSchema.safeParse({
      month: row[columns.month]?.trim(),
      channel: row[columns.channel]?.trim(),
      stage: row[columns.stage]?.trim().toLowerCase(),
      target: row[columns.target]?.trim(),
    })

    if (!parsed.success) throw invalidRowError(SHEET_LABEL, offset, parsed.error.issues)

    return [parsed.data]
  })
}
