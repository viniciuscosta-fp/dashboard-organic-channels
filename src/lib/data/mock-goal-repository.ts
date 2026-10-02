import type { GoalRepository } from './goal-repository'
import { METRICS, type Metric, type MonthlyGoal } from './types'

/**
 * Metas de exemplo, calibradas contra o que `mock-funnel-repository` gera.
 *
 * Os alvos foram escolhidos para o dashboard mostrar os três status de uma vez:
 * `organic_site`, `compare`, `paid_search` e `social_instagram` fecham perto da
 * meta; `blog_fluencypass`, `ai_referrals`, `paid_display` e `social_youtube`
 * ficam na faixa de atenção; `brand` e `paid_social` aparecem em risco. Um mock
 * em que tudo bate a meta não exercita a parte do dashboard que existe
 * justamente para avisar quando algo não bate.
 */

/** Meta mensal de referência, no mês de `REFERENCE_MONTH`. */
const GOAL_BASE: Record<string, Record<Metric, number>> = {
  organic_site: { revenue: 59000, mqls: 335, opportunities: 88, customers: 24 },
  blog_fluencypass: { revenue: 31000, mqls: 200, opportunities: 50, customers: 15 },
  compare: { revenue: 31000, mqls: 124, opportunities: 36, customers: 12 },
  brand: { revenue: 56000, mqls: 118, opportunities: 43, customers: 17 },
  ai_referrals: { revenue: 28500, mqls: 122, opportunities: 36, customers: 10 },
  paid_search: { revenue: 40500, mqls: 240, opportunities: 60, customers: 16 },
  paid_social: { revenue: 21200, mqls: 255, opportunities: 46, customers: 10 },
  paid_display: { revenue: 4700, mqls: 83, opportunities: 12, customers: 3 },
  social_instagram: { revenue: 8600, mqls: 85, opportunities: 17, customers: 4 },
  social_youtube: { revenue: 10200, mqls: 75, opportunities: 16, customers: 4 },
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
      for (const metric of METRICS) {
        goals.push({
          month,
          channel,
          metric,
          target: Math.round(targets[metric] * growth),
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
