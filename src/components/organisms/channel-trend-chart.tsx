'use client'

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { SeriesLegend } from '@/components/molecules/series-legend'
import type { TrendDatum } from '@/lib/data/funnel-view'
import { formatCount } from '@/lib/format'
import { seriesColorOf } from '@/lib/series-colors'

interface ChannelTrendChartProps {
  trend: TrendDatum[]
  /** Chaves dos canais, na ordem canônica que define a cor de cada um. */
  channels: string[]
  /** Chave do canal para o nome exibido. */
  labels: Record<string, string>
  /**
   * Canal em foco. O gráfico continua mostrando todos — comparar é o motivo de
   * ele existir —, e o canal em foco ganha traço mais grosso.
   */
  highlight?: string | null
}

export function ChannelTrendChart({
  trend,
  channels,
  labels,
  highlight = null,
}: ChannelTrendChartProps) {
  // Recharts precisa de linhas planas; o modelo de visualização guarda os
  // canais aninhados para não colidir com `date` e `label`.
  const data = trend.map((point) => ({ label: point.label, ...point.channels }))

  // A opacidade sozinha é pista visual, e identidade de série não pode depender
  // disso: o sufixo na legenda é o que sustenta a leitura.
  const legend = channels.map((channel) => ({
    label:
      channel === highlight
        ? `${labels[channel] ?? channel} (em foco)`
        : (labels[channel] ?? channel),
    color: seriesColorOf(channels, channel),
  }))

  return (
    <div className="space-y-3">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: 'var(--axis)' }}
              tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
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
              formatter={(value) => formatCount(Number(value))}
            />
            {channels.map((channel) => {
              const focused = channel === highlight

              return (
                <Line
                  key={channel}
                  name={labels[channel] ?? channel}
                  type="monotone"
                  dataKey={channel}
                  stroke={seriesColorOf(channels, channel)}
                  strokeWidth={focused ? 3 : 2}
                  strokeOpacity={highlight === null || focused ? 1 : 0.35}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
                  isAnimationActive={false}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <SeriesLegend items={legend} />
    </div>
  )
}
