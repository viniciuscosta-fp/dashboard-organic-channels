import Link from 'next/link'

import { FUNNEL_STAGES, FUNNEL_STAGE_LABELS, type FunnelStage } from '@/lib/data/types'

interface StageTabsProps {
  current: FunnelStage
  /** Parâmetros do período em uso, preservados ao trocar de etapa. */
  periodQuery: Record<string, string>
}

/** Escolhe qual etapa do funil o gráfico acumulado mostra. */
export function StageTabs({ current, periodQuery }: StageTabsProps) {
  return (
    <nav aria-label="Etapa do funil">
      <ul className="flex flex-wrap gap-1.5">
        {FUNNEL_STAGES.map((stage) => {
          const active = stage === current

          return (
            <li key={stage}>
              <Link
                href={{ pathname: '/', query: { ...periodQuery, etapa: stage } }}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'bg-ink text-surface rounded-full px-3 py-1 text-xs font-medium'
                    : 'ring-hairline text-ink-secondary hover:text-ink rounded-full px-3 py-1 text-xs ring-1'
                }
              >
                {FUNNEL_STAGE_LABELS[stage]}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
