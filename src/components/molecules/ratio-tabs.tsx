import Link from 'next/link'

import { FUNNEL_RATIO_DEFINITIONS, CONVERSION_RATIOS, type ConversionRatio } from '@/lib/data/types'

interface RatioTabsProps {
  current: ConversionRatio
  /** Parâmetros dos outros eixos, preservados ao trocar de transição. */
  baseQuery: Record<string, string>
}

/** Escolhe qual transição do funil a tabela de conversão mostra. */
export function RatioTabs({ current, baseQuery }: RatioTabsProps) {
  return (
    <nav aria-label="Transição do funil">
      <ul className="flex flex-wrap gap-1.5">
        {CONVERSION_RATIOS.map((ratio) => {
          const active = ratio === current

          return (
            <li key={ratio}>
              <Link
                href={{ pathname: '/', query: { ...baseQuery, taxa: ratio } }}
                aria-current={active ? 'page' : undefined}
                title={FUNNEL_RATIO_DEFINITIONS[ratio].label}
                className={
                  active
                    ? 'bg-ink text-surface rounded-full px-3 py-1 text-xs font-medium'
                    : 'ring-hairline text-ink-secondary hover:text-ink rounded-full px-3 py-1 text-xs ring-1'
                }
              >
                {FUNNEL_RATIO_DEFINITIONS[ratio].shortLabel}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
