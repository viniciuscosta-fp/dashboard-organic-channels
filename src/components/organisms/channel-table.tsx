import type { ChannelRow } from '@/lib/data/funnel-view'
import { formatCount, formatRate } from '@/lib/format'

const SERIES_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)']

interface ChannelTableProps {
  rows: ChannelRow[]
  /** Ordem canônica dos canais, para que a cor case com a do gráfico de linhas. */
  channels: string[]
}

/**
 * Leitura numérica do funil por canal.
 *
 * Além de ser útil por si, é a alternativa em texto exigida pelas cores de
 * série de contraste mais baixo no modo claro: nenhum número do dashboard
 * depende de distinguir matizes.
 */
export function ChannelTable({ rows, channels }: ChannelTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-sm">
        <thead>
          <tr className="text-ink-muted border-hairline border-b text-xs">
            <th scope="col" className="py-2 pr-3 text-left font-medium">
              Canal
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              MQLs
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              Oportunidades
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              Clientes
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              MQL → Cliente
            </th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((row) => (
            <tr key={row.channel} className="border-hairline border-b last:border-0">
              <th scope="row" className="text-ink py-2.5 pr-3 text-left font-medium">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        SERIES_COLORS[channels.indexOf(row.channel) % SERIES_COLORS.length],
                    }}
                  />
                  {row.channel}
                </span>
              </th>
              <td className="text-ink py-2.5 pr-3 text-right">{formatCount(row.mqls)}</td>
              <td className="text-ink py-2.5 pr-3 text-right">{formatCount(row.opportunities)}</td>
              <td className="text-ink py-2.5 pr-3 text-right">{formatCount(row.customers)}</td>
              <td className="text-ink-secondary py-2.5 text-right">
                {formatRate(row.customers, row.mqls)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
