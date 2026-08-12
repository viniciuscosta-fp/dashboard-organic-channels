import { getEnv } from '../env'
import type { GoalRepository } from './goal-repository'
import { parseGoalRows } from './goals-parser'
import { fetchSheetValues } from './sheets-client'
import type { MonthlyGoal } from './types'

/** Lê as metas mensais da aba `metas`, na mesma planilha do funil. */
export class SheetsGoalRepository implements GoalRepository {
  readonly source = 'sheets' as const

  async getGoals(): Promise<MonthlyGoal[]> {
    return parseGoalRows(await fetchSheetValues(getEnv().GOALS_SHEET_RANGE))
  }
}
