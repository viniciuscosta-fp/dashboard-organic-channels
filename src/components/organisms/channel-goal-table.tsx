import { StatusBadge } from '@/components/molecules/status-badge'
import type { ChannelAdherence } from '@/lib/data/goal-math'
import { FUNNEL_STAGE_LABELS } from '@/lib/data/types'
import { formatCount, formatRatio, formatSignedCount } from '@/lib/format'

const SERIES_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)']

interface ChannelGoalTableProps {
  channels: ChannelAdherence[]
  /** Ordem canônica dos canais, para a cor casar com a do gráfico de linhas. */
  order: string[]
}

/**
 * Aderência de cada canal, etapa por etapa.
 *
 * É também a leitura alternativa em texto que as cores de série de contraste
 * mais baixo exigem: nenhum número do dashboard depende de distinguir matizes.
 */
export function ChannelGoalTable({ channels, order }: ChannelGoalTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[46rem] text-sm">
        <thead>
          <tr className="text-ink-muted border-hairline border-b text-xs">
            <th scope="col" className="py-2 pr-3 text-left font-medium">
              Canal
            </th>
            <th scope="col" className="py-2 pr-3 text-left font-medium">
              Etapa
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
            <th scope="col" className="py-2 text-left font-medium">
              Status
            </th>
          </tr>
        </thead>

        {channels.map((entry) => (
          <tbody
            key={entry.channel}
            className="border-hairline border-b tabular-nums last:border-0"
          >
            {entry.stages.map((stage, index) => (
              <tr key={stage.stage}>
                {index === 0 ? (
                  <th
                    scope="rowgroup"
                    rowSpan={entry.stages.length}
                    className="text-ink py-2.5 pr-3 text-left align-top font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            SERIES_COLORS[order.indexOf(entry.channel) % SERIES_COLORS.length],
                        }}
                      />
                      {entry.channel}
                    </span>
                  </th>
                ) : null}

                <td className="text-ink-secondary py-2.5 pr-3">
                  {FUNNEL_STAGE_LABELS[stage.stage]}
                </td>
                <td className="text-ink py-2.5 pr-3 text-right">{formatCount(stage.actual)}</td>
                <td className="text-ink-secondary py-2.5 pr-3 text-right">
                  {stage.goalPeriod > 0 ? formatCount(Math.round(stage.goalPeriod)) : '—'}
                </td>
                <td className="text-ink py-2.5 pr-3 text-right">
                  {stage.goalPeriod > 0 ? formatSignedCount(stage.gap) : '—'}
                </td>
                <td className="text-ink py-2.5 pr-3 text-right">
                  {stage.projection === null ? '—' : formatCount(Math.round(stage.projection))}
                  {stage.projectedAttainment === null ? (
                    ''
                  ) : (
                    <span className="text-ink-muted">
                      {' '}
                      · {formatRatio(stage.projectedAttainment)}
                    </span>
                  )}
                </td>
                <td className="py-2.5">
                  <StatusBadge status={stage.status} size="sm" />
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}
