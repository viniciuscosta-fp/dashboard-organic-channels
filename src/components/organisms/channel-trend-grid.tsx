'use client'

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import type { ChannelSection } from '@/lib/data/channel-catalog'
import type { TrendDatum } from '@/lib/data/funnel-view'
import { formatCount } from '@/lib/format'
import { colorOf } from '@/lib/series-colors'

interface ChannelTrendGridProps {
  trend: TrendDatum[]
  /** Canais na ordem canônica, já divididos por grupo. */
  sections: ChannelSection[]
  /** Cor de cada canal, pelo slot do grupo. */
  colors: Record<string, string>
  /**
   * Canal em foco. A grade continua mostrando todos — comparar é o motivo de
   * ela existir —, e o painel em foco ganha contorno e a palavra "em foco".
   */
  highlight?: string | null
}

/**
 * Evolução de MQLs com um mini-gráfico por canal (_small multiples_).
 *
 * Substitui o gráfico de linhas único, que com dez ou quinze canais vira um
 * novelo: as linhas se sobrepõem, a legenda passa a pesar mais que o gráfico e
 * o canal pequeno some colado no zero da escala do grande. Aqui cada painel tem
 * um canal só, identificado pelo nome no título — a cor diz apenas o grupo.
 *
 * A escala vertical é **própria de cada painel**, de propósito: o que este bloco
 * responde é a forma da curva (subindo, caindo, parado), não quem é maior. O
 * total do período no título de cada painel e as tabelas abaixo respondem a
 * comparação de volume — e a nota de rodapé diz isso a quem lê.
 */
export function ChannelTrendGrid({
  trend,
  sections,
  colors,
  highlight = null,
}: ChannelTrendGridProps) {
  const first = trend.at(0)?.label
  const last = trend.at(-1)?.label

  return (
    <div className="space-y-5">
      {sections.map((section, index) => (
        <section key={section.label ?? `sem-grupo-${index}`} className="space-y-2">
          {section.label ? (
            <h3 className="text-ink-secondary text-xs font-medium">{section.label}</h3>
          ) : null}

          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {section.channels.map((entry) => (
              <li key={entry.channel}>
                <TrendPanel
                  label={entry.label}
                  color={colorOf(colors, entry.channel)}
                  data={trend.map((point) => ({
                    label: point.label,
                    value: point.channels[entry.channel] ?? 0,
                  }))}
                  focused={entry.channel === highlight}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="text-ink-muted text-xs">
        {first && last && first !== last ? `De ${first} a ${last}. ` : ''}
        Cada painel tem escala própria: compare a forma das curvas, não a altura entre painéis. O
        volume de cada canal está no título do painel e nas tabelas.
      </p>
    </div>
  )
}

interface TrendPanelProps {
  label: string
  color: string
  data: { label: string; value: number }[]
  focused: boolean
}

function TrendPanel({ label, color, data, focused }: TrendPanelProps) {
  const total = data.reduce((sum, point) => sum + point.value, 0)

  return (
    <figure
      aria-current={focused ? 'true' : undefined}
      className={`rounded-lg p-3 ${focused ? 'ring-ink ring-2' : 'ring-hairline ring-1'}`}
    >
      {/* Nome em linha própria: ao lado do total, truncava já com cinco colunas. */}
      <figcaption className="mb-1 text-xs">
        <span className="text-ink flex items-center gap-1.5 font-medium">
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="truncate" title={label}>
            {label}
          </span>
        </span>
        <span className="text-ink-secondary block pl-3.5 tabular-nums">
          {formatCount(total)} MQLs
          {/* O destaque não pode viver só no contorno. */}
          {focused ? <span className="text-ink-muted"> · em foco</span> : null}
        </span>
      </figcaption>

      <div className="h-20 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis dataKey="label" hide />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={28}
              tickCount={3}
              allowDecimals={false}
              tick={{ fill: 'var(--ink-muted)', fontSize: 10 }}
            />
            <Tooltip
              cursor={{ stroke: 'var(--axis)', strokeWidth: 1 }}
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--hairline)',
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--ink)',
              }}
              labelStyle={{ color: 'var(--ink-secondary)', marginBottom: 4 }}
              formatter={(value) => [formatCount(Number(value)), 'MQLs']}
            />
            <Line
              type="monotone"
              dataKey="value"
              name={label}
              stroke={color}
              strokeWidth={focused ? 2.5 : 1.75}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 2, stroke: 'var(--surface)' }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
