import { StatusBadge } from '@/components/molecules/status-badge'
import type { ChannelCatalog } from '@/lib/data/channel-catalog'
import { groupLabelOf, labelOf } from '@/lib/data/channel-catalog'
import type { ChannelAdherence } from '@/lib/data/goal-math'
import { findMetricComparison, type PeriodComparison } from '@/lib/data/period-comparison'
import { METRIC_LABELS, type Metric } from '@/lib/data/types'
import { formatMetricValue, formatRatio, formatSignedMetric, formatSignedRatio } from '@/lib/format'
import { colorOf } from '@/lib/series-colors'

interface ChannelGoalTableProps {
  /** Canais na ordem de exibição — do mais urgente ao menos, vindo da rota. */
  channels: ChannelAdherence[]
  catalog: ChannelCatalog
  /** Cor de cada canal, pelo slot do grupo, para casar com gráficos e seletor. */
  colors: Record<string, string>
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
 * Os canais chegam ordenados por urgência (`sortByUrgency`), não pela ordem do
 * cadastro: com dez ou quinze canais são quarenta linhas ou mais, e o canal em
 * risco precisa estar no topo. Por isso o grupo aparece por extenso sob o nome
 * do canal — a ordem não junta mais os canais de uma mesma família.
 *
 * É também a leitura alternativa em texto que as cores de série de contraste
 * mais baixo exigem: nenhum número do dashboard depende de distinguir matizes.
 */
export function ChannelGoalTable({
  channels,
  catalog,
  colors,
  highlight = null,
  comparison = null,
}: ChannelGoalTableProps) {
  const showsComparison = comparison !== null && comparison.unavailable === null

  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-sm ${showsComparison ? 'min-w-[54rem]' : 'min-w-[48rem]'}`}>
        <thead>
          <tr className="text-ink-muted border-hairline border-b text-xs">
            <th
              scope="col"
              className="bg-surface sticky left-0 z-10 py-2 pr-3 text-left font-medium"
            >
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
                      className="bg-surface text-ink sticky left-0 z-10 py-2.5 pr-3 text-left align-top font-medium"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="mt-1 size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: colorOf(colors, entry.channel) }}
                        />
                        <span>
                          {labelOf(catalog, entry.channel)}
                          {groupLabelOf(catalog, entry.channel) ? (
                            <span className="text-ink-muted block text-xs font-normal">
                              {groupLabelOf(catalog, entry.channel)}
                            </span>
                          ) : null}
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
