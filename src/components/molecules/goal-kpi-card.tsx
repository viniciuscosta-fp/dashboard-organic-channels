import { Card } from '@/components/atoms/card'
import { StatusBadge } from '@/components/molecules/status-badge'
import type { MetricAdherence } from '@/lib/data/goal-math'
import { METRIC_LABELS } from '@/lib/data/types'
import { formatMetricValue, formatRatio } from '@/lib/format'

interface GoalKpiCardProps {
  adherence: MetricAdherence
}

/**
 * O número da métrica e o julgamento sobre ele.
 *
 * Só isso, de propósito. Meta, gap contra o ritmo e projeção estão todos na
 * curva acumulada logo abaixo, e repeti-los aqui enchia o topo da tela com seis
 * linhas por cartão — o que a curva mostra de relance passava a exigir leitura.
 *
 * O que fica é o que a curva **não** dá: as quatro métricas ao mesmo tempo (a
 * curva mostra uma por vez), o status, que é a única leitura de "estou bem ou
 * mal" que funciona nas quatro de uma vez, e a fração da meta que o número
 * representa. O selo cobre inclusive a ausência de meta, então o cartão não
 * precisa de uma linha para dizer isso.
 *
 * A fração é sobre a meta **do período inteiro**, não sobre a parte já
 * decorrida: é a resposta a "quanto do mês já entrou". Ela se lê contra a fração
 * do período decorrido, que a régua mostra logo acima — 33% da meta com 38% dos
 * dias úteis passados é diferente de 33% com 20%.
 */
export function GoalKpiCard({ adherence }: GoalKpiCardProps) {
  const { metric, actual, status, attainment } = adherence

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
        {attainment === null ? null : (
          <p className="text-ink-muted mt-1 text-xs tabular-nums">
            {formatRatio(attainment)} da meta do período
          </p>
        )}
      </div>
    </Card>
  )
}
