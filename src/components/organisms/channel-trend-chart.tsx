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

/**
 * Slots categóricos, atribuídos por posição fixa e nunca reciclados.
 *
 * A cor segue o canal, não a sua posição no ranking: filtrar um canal não
 * pode repintar os que sobraram.
 */
const SERIES_COLORS = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
]

interface ChannelTrendChartProps {
  trend: TrendDatum[]
  /** Chaves dos canais, na ordem canônica que define a cor de cada um. */
  channels: string[]
  /** Chave do canal para o nome exibido. */
  labels: Record<string, string>
}

export function ChannelTrendChart({ trend, channels, labels }: ChannelTrendChartProps) {
  // Recharts precisa de linhas planas; o modelo de visualização guarda os
  // canais aninhados para não colidir com `date` e `label`.
  const data = trend.map((point) => ({ label: point.label, ...point.channels }))

  const legend = channels.map((channel, index) => ({
    label: labels[channel] ?? channel,
    color: SERIES_COLORS[index % SERIES_COLORS.length],
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
            {channels.map((channel, index) => (
              <Line
                key={channel}
                name={labels[channel] ?? channel}
                type="monotone"
                dataKey={channel}
                stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <SeriesLegend items={legend} />
    </div>
  )
}
