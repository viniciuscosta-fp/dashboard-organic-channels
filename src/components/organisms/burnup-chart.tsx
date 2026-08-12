'use client'

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { SeriesLegend } from '@/components/molecules/series-legend'
import type { BurnupPoint } from '@/lib/data/goal-math'
import { isCurrencyMetric, type Metric } from '@/lib/data/types'
import { formatCompactMetric, formatDayMonth, formatMetricValue } from '@/lib/format'

interface BurnupChartProps {
  points: BurnupPoint[]
  /** Último dia com dado, para marcar onde o realizado acaba. */
  anchorDate: string | null
  /** Define se os valores são lidos como reais ou como contagem. */
  metric: Metric
}

/**
 * Realizado acumulado contra a linha de meta, com a continuação estimada.
 *
 * A meta é desenhada com a tinta de eixo, e não com uma cor de série: ela é a
 * régua contra a qual o dado é lido, não mais um concorrente na disputa por
 * atenção. Assim o gráfico tem uma única matiz de dado, o que também o mantém
 * legível para quem não distingue cores.
 */
export function BurnupChart({ points, anchorDate, metric }: BurnupChartProps) {
  const data = points.map((point) => ({ ...point, label: formatDayMonth(point.date) }))
  const hasProjection = points.some((point) => point.projected !== null)

  const legend = [
    { label: 'Realizado', color: 'var(--series-1)' },
    { label: 'Meta acumulada', color: 'var(--ink-muted)' },
    ...(hasProjection ? [{ label: 'Projeção', color: 'var(--series-1)' }] : []),
  ]

  return (
    <div className="space-y-3">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: 'var(--axis)' }}
              tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              // Valor em reais precisa de mais espaço: em 56px, "165 mil" era
              // cortado e virava "65 mil" — número errado, não só feio.
              width={isCurrencyMetric(metric) ? 76 : 56}
              tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
              // Receita cheia não cabe em tick de eixo; aqui abrevia e o
              // tooltip mostra o valor completo.
              tickFormatter={(value: number) => formatCompactMetric(metric, value)}
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
              formatter={(value) => formatMetricValue(metric, Number(value))}
            />

            {anchorDate ? (
              <ReferenceLine
                x={formatDayMonth(anchorDate)}
                stroke="var(--axis)"
                strokeDasharray="2 3"
                label={{
                  value: 'último dado',
                  position: 'insideTopLeft',
                  fill: 'var(--ink-muted)',
                  fontSize: 10,
                }}
              />
            ) : null}

            <Line
              name="Meta acumulada"
              type="monotone"
              dataKey="goal"
              // Tinta neutra, e não a do eixo: a meta é a régua da leitura, mas
              // ainda é dado — em `--axis` ela some no modo claro.
              stroke="var(--ink-muted)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              name="Realizado"
              type="monotone"
              dataKey="actual"
              stroke="var(--series-1)"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              name="Projeção"
              type="monotone"
              dataKey="projected"
              stroke="var(--series-1)"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <SeriesLegend items={legend} />
    </div>
  )
}
