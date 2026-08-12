import Link from 'next/link'

import { PERIOD_PRESETS, type DateRange, type PeriodPresetId } from '@/lib/period'

interface PeriodPickerProps {
  /** `null` quando o período em uso é um intervalo personalizado. */
  current: PeriodPresetId | null
  range: DateRange
  /** Métrica selecionada no burn-up, preservada ao trocar de período. */
  metric: string
}

/**
 * Seleção de período.
 *
 * Não usa JavaScript: os presets são links e o intervalo personalizado é um
 * formulário `GET`, que o navegador transforma em query string sozinho. Além de
 * não custar bundle, isso deixa qualquer período compartilhável por URL.
 */
export function PeriodPicker({ current, range, metric }: PeriodPickerProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <nav aria-label="Período">
        <ul className="flex flex-wrap gap-1.5">
          {PERIOD_PRESETS.map((preset) => {
            const active = preset.id === current

            return (
              <li key={preset.id}>
                <Link
                  href={{ pathname: '/', query: { periodo: preset.id, metrica: metric } }}
                  aria-current={active ? 'page' : undefined}
                  className={
                    active
                      ? 'bg-ink text-surface rounded-full px-3 py-1.5 text-xs font-medium'
                      : 'ring-hairline text-ink-secondary hover:text-ink rounded-full px-3 py-1.5 text-xs ring-1'
                  }
                >
                  {preset.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="metrica" value={metric} />

        <label className="text-ink-muted flex flex-col gap-1 text-xs">
          De
          <input
            type="date"
            name="de"
            defaultValue={range.from}
            className="bg-surface ring-hairline text-ink rounded-md px-2 py-1.5 text-xs ring-1"
          />
        </label>

        <label className="text-ink-muted flex flex-col gap-1 text-xs">
          Até
          <input
            type="date"
            name="ate"
            defaultValue={range.to}
            className="bg-surface ring-hairline text-ink rounded-md px-2 py-1.5 text-xs ring-1"
          />
        </label>

        <button
          type="submit"
          className="ring-hairline text-ink-secondary hover:text-ink rounded-md px-3 py-1.5 text-xs ring-1"
        >
          Aplicar
        </button>
      </form>
    </div>
  )
}
