import Link from 'next/link'

import { METRICS, METRIC_LABELS, type Metric } from '@/lib/data/types'

interface MetricTabsProps {
  current: Metric
  /**
   * Parâmetros dos outros eixos do dashboard, preservados ao trocar de métrica.
   * Vem de `dashboardSearchParams(params, ['metrica'])`.
   */
  baseQuery: Record<string, string>
}

/** Escolhe qual métrica o gráfico acumulado mostra. */
export function MetricTabs({ current, baseQuery }: MetricTabsProps) {
  return (
    <nav aria-label="Métrica">
      <ul className="flex flex-wrap gap-1.5">
        {METRICS.map((metric) => {
          const active = metric === current

          return (
            <li key={metric}>
              <Link
                href={{ pathname: '/', query: { ...baseQuery, metrica: metric } }}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'bg-ink text-surface rounded-full px-3 py-1 text-xs font-medium'
                    : 'ring-hairline text-ink-secondary hover:text-ink rounded-full px-3 py-1 text-xs ring-1'
                }
              >
                {METRIC_LABELS[metric]}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
