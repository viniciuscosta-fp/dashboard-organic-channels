'use client'

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import type { StageDatum } from '@/lib/data/funnel-view'
import { formatCount } from '@/lib/format'

/** Cores da rampa ordinal, uma matiz só, na ordem das etapas do funil. */
const STAGE_COLORS = ['var(--stage-1)', 'var(--stage-2)', 'var(--stage-3)']

interface FunnelStagesChartProps {
  stages: StageDatum[]
}

/**
 * Barras horizontais das etapas do funil.
 *
 * Barra horizontal e não vertical porque o rótulo de cada etapa é uma palavra
 * inteira — na vertical viraria texto rotacionado.
 */
export function FunnelStagesChart({ stages }: FunnelStagesChartProps) {
  return (
    // Altura casada com o gráfico de linhas ao lado (h-64 mais a legenda).
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={stages}
          margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={104}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--ink-secondary)', fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: 'var(--grid)', fillOpacity: 0.5 }}
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--hairline)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--ink)',
            }}
            labelStyle={{ color: 'var(--ink-secondary)', marginBottom: 2 }}
            formatter={(value) => [formatCount(Number(value)), 'Total']}
          />
          <Bar dataKey="value" barSize={26} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {stages.map((stage, index) => (
              <Cell key={stage.stage} fill={STAGE_COLORS[index]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
