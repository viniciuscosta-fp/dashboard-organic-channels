import type { PeriodTiming } from '@/lib/data/goal-math'
import { formatLongDay, formatRatio } from '@/lib/format'

interface PeriodSummaryProps {
  timing: PeriodTiming
  /** Meses do período sem meta cadastrada, em ISO `AAAA-MM`. */
  missingGoalMonths: string[]
  /** Canais que apareceram no funil sem estar na aba de cadastro. */
  unregisteredChannels: string[]
}

/**
 * Régua do período: até onde há dado e quanto do período já passou.
 *
 * O frescor do dado fica visível de propósito. Todo número da tela depende de
 * até quando o n8n escreveu — se o flow parou há três dias, quem está olhando
 * precisa saber disso antes de tomar qualquer decisão.
 */
export function PeriodSummary({
  timing,
  missingGoalMonths,
  unregisteredChannels,
}: PeriodSummaryProps) {
  const { lastDataDate, businessDaysElapsed, businessDaysTotal, elapsedRatio } = timing

  return (
    <div className="text-ink-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span>
        {formatLongDay(timing.range.from)} a {formatLongDay(timing.range.to)}
      </span>

      <span aria-hidden>·</span>

      <span>
        {lastDataDate ? `dados até ${formatLongDay(lastDataDate)}` : 'nenhum dado no período'}
      </span>

      <span aria-hidden>·</span>

      <span>
        {businessDaysElapsed} de {businessDaysTotal} dias úteis ({formatRatio(elapsedRatio)})
      </span>

      {missingGoalMonths.length > 0 ? (
        <span className="text-ink-secondary">
          <span aria-hidden>⚠ </span>
          sem meta cadastrada para {missingGoalMonths.join(', ')}
        </span>
      ) : null}

      {unregisteredChannels.length > 0 ? (
        <span className="text-ink-secondary">
          <span aria-hidden>⚠ </span>
          canal fora do cadastro: {unregisteredChannels.join(', ')}
        </span>
      ) : null}
    </div>
  )
}
