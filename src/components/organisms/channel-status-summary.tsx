import Link from 'next/link'

import { StatusBadge } from '@/components/molecules/status-badge'
import type { StatusGroup } from '@/lib/data/funnel-view'
import { METRIC_LABELS } from '@/lib/data/types'
import { formatCount } from '@/lib/format'
import { colorOf } from '@/lib/series-colors'

interface ChannelStatusSummaryProps {
  /** Os quatro status, do mais urgente ao menos, com os canais de cada um. */
  groups: StatusGroup[]
  labels: Record<string, string>
  colors: Record<string, string>
  /** Canal em foco, marcado na lista. */
  current: string | null
  /** Parâmetros dos outros eixos, preservados ao abrir um canal. */
  baseQuery: Record<string, string>
}

/**
 * Quantos canais estão em cada status, e quais — antes de qualquer tabela.
 *
 * Com dez ou quinze canais, a pergunta "quem está em risco?" não pode depender
 * de rolar uma tabela de quarenta linhas. Cada canal aparece uma vez, no seu
 * pior status, com as métricas que o puseram ali; o nome é link para pôr o canal
 * em foco, que é o gesto seguinte natural.
 *
 * Status vem sempre com ícone e rótulo (`StatusBadge`), nunca só com cor.
 */
export function ChannelStatusSummary({
  groups,
  labels,
  colors,
  current,
  baseQuery,
}: ChannelStatusSummaryProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {groups.map(({ status, channels }) => (
        <section key={status} className="space-y-2">
          <h3 className="flex items-baseline gap-2">
            <StatusBadge status={status} />
            <span className="text-ink text-sm font-semibold tabular-nums">
              {formatCount(channels.length)}
            </span>
          </h3>

          {channels.length === 0 ? (
            <p className="text-ink-muted text-xs">Nenhum canal</p>
          ) : (
            <ul className="space-y-1">
              {channels.map((entry) => (
                <li key={entry.channel} className="text-xs">
                  <Link
                    href={{ pathname: '/', query: { ...baseQuery, canal: entry.channel } }}
                    aria-current={entry.channel === current ? 'page' : undefined}
                    className="text-ink-secondary hover:text-ink aria-[current=page]:text-ink inline-flex items-center gap-1.5 underline-offset-2 hover:underline aria-[current=page]:font-medium"
                  >
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: colorOf(colors, entry.channel) }}
                    />
                    {labels[entry.channel] ?? entry.channel}
                    {entry.channel === current ? (
                      <span className="text-ink-muted font-normal">(em foco)</span>
                    ) : null}
                  </Link>
                  {/* Em "no ritmo" todas as métricas com meta estão lá; listar seria ruído. */}
                  {status === 'risco' || status === 'atencao' ? (
                    <span className="text-ink-muted block pl-3.5">
                      {entry.metrics.map((metric) => METRIC_LABELS[metric]).join(', ')}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
