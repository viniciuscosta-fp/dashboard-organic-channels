import { Card } from '@/components/atoms/card'
import { StatusBadge } from '@/components/molecules/status-badge'
import type { MetricAdherence, ProjectionConfidence } from '@/lib/data/goal-math'
import { METRIC_LABELS } from '@/lib/data/types'
import { formatMetricValue, formatRatio, formatSignedMetric } from '@/lib/format'

const CONFIDENCE_NOTE: Record<ProjectionConfidence, string | null> = {
  normal: null,
  baixa: 'Projeção de baixa confiança: pouco do período decorreu.',
  insuficiente: 'Histórico recente insuficiente para projetar.',
  'periodo-fechado': 'Período encerrado: este é o resultado final.',
}

interface GoalKpiCardProps {
  adherence: MetricAdherence
}

/**
 * Número da métrica com o contexto que o torna acionável.
 *
 * Sozinho, "30 clientes" não diz nada. O que decide uma reunião é 30 contra a
 * meta, contra o ritmo esperado até aqui, e contra onde o mês vai fechar.
 */
export function GoalKpiCard({ adherence }: GoalKpiCardProps) {
  const { metric, actual, goalPeriod, gap, projection, projectedAttainment, status, confidence } =
    adherence

  const note = CONFIDENCE_NOTE[confidence]
  const hasGoal = goalPeriod > 0

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-ink-secondary text-xs font-medium tracking-wide uppercase">
          {METRIC_LABELS[metric]}
        </h3>
        <StatusBadge status={status} size="sm" />
      </div>

      <div>
        <p className="text-ink text-3xl font-semibold">{formatMetricValue(metric, actual)}</p>
        <p className="text-ink-muted mt-1 text-xs">
          {hasGoal
            ? `de ${formatMetricValue(metric, goalPeriod)} no período`
            : 'sem meta cadastrada'}
        </p>
      </div>

      {hasGoal ? (
        <dl className="border-hairline grid grid-cols-2 gap-x-3 gap-y-1 border-t pt-3 text-xs">
          <dt className="text-ink-muted">Contra o ritmo</dt>
          <dd className="text-ink text-right tabular-nums">{formatSignedMetric(metric, gap)}</dd>

          <dt className="text-ink-muted">Projeção</dt>
          <dd className="text-ink text-right tabular-nums">
            {projection === null ? '—' : formatMetricValue(metric, projection)}
            {projectedAttainment === null ? '' : ` · ${formatRatio(projectedAttainment)}`}
          </dd>
        </dl>
      ) : null}

      {note ? <p className="text-ink-muted text-xs">{note}</p> : null}
    </Card>
  )
}
