import { StatusBadge } from '@/components/molecules/status-badge'
import type { ChannelCatalog } from '@/lib/data/channel-catalog'
import { labelOf } from '@/lib/data/channel-catalog'
import type { ChannelAdherence } from '@/lib/data/goal-math'
import { findMetricComparison, type PeriodComparison } from '@/lib/data/period-comparison'
import { METRIC_LABELS, type Metric } from '@/lib/data/types'
import { formatMetricValue, formatRatio, formatSignedMetric, formatSignedRatio } from '@/lib/format'
import { seriesColorOf } from '@/lib/series-colors'

interface ChannelGoalTableProps {
  channels: ChannelAdherence[]
  catalog: ChannelCatalog
  /** Ordem canônica dos canais, para a cor casar com a do gráfico de linhas. */
  order: string[]
  /** Canal em foco. A tabela segue completa; a linha dele é que se destaca. */
  highlight?: string | null
  /**
   * Comparação com o período anterior. Ausente ou indisponível esconde a coluna
   * inteira, em vez de encher a tabela de travessões.
   */
  comparison?: PeriodComparison | null
}

/**
 * Aderência de cada canal, métrica por métrica.
 *
 * É também a leitura alternativa em texto que as cores de série de contraste
 * mais baixo exigem: nenhum número do dashboard depende de distinguir matizes.
 */
export function ChannelGoalTable({
  channels,
  catalog,
  order,
  highlight = null,
  comparison = null,
}: ChannelGoalTableProps) {
  const showsComparison = comparison !== null && comparison.unavailable === null

  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-sm ${showsComparison ? 'min-w-[54rem]' : 'min-w-[48rem]'}`}>
        <thead>
          <tr className="text-ink-muted border-hairline border-b text-xs">
            <th scope="col" className="py-2 pr-3 text-left font-medium">
              Canal
            </th>
            <th scope="col" className="py-2 pr-3 text-left font-medium">
              Métrica
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              Realizado
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              Meta
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              Contra o ritmo
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              Projeção
            </th>
            {showsComparison ? (
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                vs. anterior
              </th>
            ) : null}
            <th scope="col" className="py-2 text-left font-medium">
              Status
            </th>
          </tr>
        </thead>

        {channels.map((entry) => {
          const focused = entry.channel === highlight

          return (
            <tbody
              key={entry.channel}
              className="border-hairline border-b tabular-nums last:border-0"
            >
              {entry.metrics.map((metric, index) => (
                <tr key={metric.metric}>
                  {index === 0 ? (
                    <th
                      scope="rowgroup"
                      rowSpan={entry.metrics.length}
                      aria-current={focused ? 'true' : undefined}
                      className="text-ink py-2.5 pr-3 text-left align-top font-medium"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="mt-1 size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: seriesColorOf(order, entry.channel) }}
                        />
                        <span>
                          {labelOf(catalog, entry.channel)}
                          {/* O destaque não pode viver só no peso da fonte. */}
                          {focused ? (
                            <span className="text-ink-muted block text-xs font-normal">
                              em foco
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </th>
                  ) : null}

                  <td className="text-ink-secondary py-2.5 pr-3">{METRIC_LABELS[metric.metric]}</td>
                  <td className="text-ink py-2.5 pr-3 text-right">
                    {formatMetricValue(metric.metric, metric.actual)}
                  </td>
                  <td className="text-ink-secondary py-2.5 pr-3 text-right">
                    {metric.goalPeriod > 0
                      ? formatMetricValue(metric.metric, metric.goalPeriod)
                      : '—'}
                  </td>
                  <td className="text-ink py-2.5 pr-3 text-right">
                    {metric.goalPeriod > 0 ? formatSignedMetric(metric.metric, metric.gap) : '—'}
                  </td>
                  <td className="text-ink py-2.5 pr-3 text-right">
                    {metric.projection === null
                      ? '—'
                      : formatMetricValue(metric.metric, metric.projection)}
                    {metric.projectedAttainment === null ? (
                      ''
                    ) : (
                      <span className="text-ink-muted">
                        {' '}
                        · {formatRatio(metric.projectedAttainment)}
                      </span>
                    )}
                  </td>
                  {showsComparison ? (
                    <ComparisonCell
                      comparison={comparison}
                      channel={entry.channel}
                      metric={metric.metric}
                    />
                  ) : null}

                  <td className="py-2.5">
                    <StatusBadge status={metric.status} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          )
        })}
      </table>
    </div>
  )
}

interface ComparisonCellProps {
  comparison: PeriodComparison
  channel: string
  metric: Metric
}

/** Variação contra a janela equivalente anterior, em valor absoluto e relativo. */
function ComparisonCell({ comparison, channel, metric }: ComparisonCellProps) {
  const entry = findMetricComparison(comparison, channel, metric)

  return (
    <td className="text-ink py-2.5 pr-3 text-right">
      {entry === null ? (
        '—'
      ) : (
        <>
          {formatSignedMetric(metric, entry.delta)}
          {entry.relative === null ? (
            ''
          ) : (
            <span className="text-ink-muted"> · {formatSignedRatio(entry.relative)}</span>
          )}
        </>
      )}
    </td>
  )
}
