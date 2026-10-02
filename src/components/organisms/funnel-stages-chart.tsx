'use client'

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { StageDatum } from '@/lib/data/funnel-view'
import { formatCount, formatOptionalRatio } from '@/lib/format'

/** Cores da rampa ordinal, uma matiz só, na ordem das etapas do funil. */
const STAGE_COLORS = ['var(--stage-1)', 'var(--stage-2)', 'var(--stage-3)']

interface FunnelStagesChartProps {
  stages: StageDatum[]
}

/**
 * Barras horizontais das etapas do funil, com a razão entre etapas vizinhas.
 *
 * Barra horizontal e não vertical porque o rótulo de cada etapa é uma palavra
 * inteira — na vertical viraria texto rotacionado.
 *
 * A razão ao lado da barra é o que dá leitura ao gráfico: as três etapas vivem
 * em ordens de grandeza diferentes, então as duas menores ficam achatadas e o
 * comprimento relativo delas não é o que informa. `buildStageData` já calcula
 * essa razão.
 */
export function FunnelStagesChart({ stages }: FunnelStagesChartProps) {
  return (
    // Altura casada com o burn-up ao lado (também h-72).
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={stages}
          // Folga à direita para o rótulo de razão da barra mais longa caber.
          margin={{ top: 4, right: 72, bottom: 4, left: 0 }}
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
            formatter={(value, _name, item) => {
              const conversion = (item?.payload as StageDatum | undefined)?.conversionFromPrevious
              const total = formatCount(Number(value))

              return conversion === null || conversion === undefined
                ? [total, 'Total']
                : [`${total} · ${formatOptionalRatio(conversion)} da etapa anterior`, 'Total']
            }}
          />
          <Bar dataKey="value" barSize={26} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {stages.map((stage, index) => (
              <Cell key={stage.stage} fill={STAGE_COLORS[index]} />
            ))}
            <LabelList
              dataKey="conversionFromPrevious"
              position="right"
              offset={8}
              fill="var(--ink-secondary)"
              fontSize={11}
              formatter={(value: unknown) =>
                typeof value === 'number' ? formatOptionalRatio(value) : ''
              }
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
