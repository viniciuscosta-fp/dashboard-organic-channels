import type { GoalRepository } from './goal-repository'
import { FUNNEL_STAGES, type FunnelStage, type MonthlyGoal } from './types'

/**
 * Metas de exemplo, calibradas contra o que `mock-funnel-repository` gera.
 *
 * Os alvos foram escolhidos para o dashboard mostrar os três status de uma vez:
 * `organic-search` fecha perto da meta, `direct` fica na faixa de atenção e
 * `referral` aparece em risco. Um mock em que tudo bate a meta não exercita a
 * parte do dashboard que existe justamente para avisar quando algo não bate.
 */

/** Meta mensal de referência, no mês de `REFERENCE_MONTH`. */
const GOAL_BASE: Record<string, Record<FunnelStage, number>> = {
  'organic-search': { mqls: 390, opportunities: 105, customers: 30 },
  direct: { mqls: 165, opportunities: 44, customers: 11 },
  referral: { mqls: 75, opportunities: 28, customers: 9 },
}

const REFERENCE_MONTH = '2026-08'

/** Crescimento composto de meta mês a mês. */
const MONTHLY_GROWTH = 0.01

/** Faixa gerada, larga o bastante para cobrir qualquer período selecionável. */
const GOAL_RANGE = { from: '2025-01', to: '2027-12' }

function monthIndex(month: string): number {
  const [year, monthNumber] = month.split('-').map(Number)
  return year * 12 + (monthNumber - 1)
}

function* eachMonth(from: string, to: string): Generator<string> {
  const end = monthIndex(to)

  for (let index = monthIndex(from); index <= end; index += 1) {
    const year = Math.floor(index / 12)
    const month = (index % 12) + 1
    yield `${year}-${String(month).padStart(2, '0')}`
  }
}

export function generateGoals(): MonthlyGoal[] {
  const reference = monthIndex(REFERENCE_MONTH)
  const goals: MonthlyGoal[] = []

  for (const month of eachMonth(GOAL_RANGE.from, GOAL_RANGE.to)) {
    const growth = (1 + MONTHLY_GROWTH) ** (monthIndex(month) - reference)

    for (const [channel, targets] of Object.entries(GOAL_BASE)) {
      for (const stage of FUNNEL_STAGES) {
        goals.push({
          month,
          channel,
          stage,
          target: Math.round(targets[stage] * growth),
        })
      }
    }
  }

  return goals
}

export class MockGoalRepository implements GoalRepository {
  readonly source = 'mock' as const

  async getGoals(): Promise<MonthlyGoal[]> {
    return generateGoals()
  }
}
