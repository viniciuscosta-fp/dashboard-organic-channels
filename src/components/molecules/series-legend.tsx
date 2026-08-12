interface SeriesLegendProps {
  items: { label: string; color: string }[]
}

/**
 * Legenda de séries.
 *
 * Sempre presente quando há duas ou mais séries: a identidade da série nunca
 * pode depender só da cor.
 */
export function SeriesLegend({ items }: SeriesLegendProps) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="text-ink-secondary flex items-center gap-1.5 text-xs">
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
