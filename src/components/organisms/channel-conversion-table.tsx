import {
  BASE_MINIMA_SEMANAL,
  type ChannelRatios,
  type RatioComparison,
} from '@/lib/data/funnel-efficiency'
import type { ConversionWeek, ConversionWeekDelta } from '@/lib/data/funnel-view'
import { FUNNEL_RATIO_DEFINITIONS, METRIC_LABELS, type ConversionRatio } from '@/lib/data/types'
import { formatCount, formatOptionalRatio, formatPoints } from '@/lib/format'
import { colorOf } from '@/lib/series-colors'

interface ChannelConversionTableProps {
  ratio: ConversionRatio
  /** Uma linha por canal, na ordem do cadastro. */
  rows: ChannelRatios[]
  /** Consolidado das linhas exibidas, no rodapé. */
  total: ChannelRatios
  /** Rótulo do rodapé: "Consolidado", ou o total do grupo selecionado. */
  totalLabel?: string
  weeks: ConversionWeek[]
  delta: ConversionWeekDelta
  /** Cor de cada canal, pelo slot do grupo, para casar com os gráficos. */
  colors: Record<string, string>
  labels: Record<string, string>
  /** Canal em foco. A tabela segue completa; a linha dele é que se destaca. */
  highlight?: string | null
}

/**
 * Razões entre etapas por canal, semana a semana.
 *
 * Tabela e não gráfico de propósito. As três transições vivem em ordens de
 * grandeza diferentes, então uma escala de cor única não significaria nada e uma
 * por coluna seria mentirosa — e magnitude codificada só em cor é justamente o
 * que este projeto não faz. Aqui cada número é lido, não estimado.
 *
 * Cada coluna tem **um** significado só: "vs meta" compara o período contra a
 * conversão implícita na meta; "Δ semana" compara as duas últimas semanas
 * exibidas. Duas comparações diferentes nunca dividem a mesma coluna.
 */
export function ChannelConversionTable({
  ratio,
  rows,
  total,
  weeks,
  delta,
  colors,
  labels,
  highlight = null,
  totalLabel = 'Consolidado',
}: ChannelConversionTableProps) {
  const definition = FUNNEL_RATIO_DEFINITIONS[ratio]
  const gapNote = describeGap(total.ratios[ratio], ratio, labels)

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm sm:min-w-[38rem] lg:min-w-[56rem]">
          <caption className="sr-only">
            {definition.label} por canal, no período e semana a semana
          </caption>

          <thead>
            <tr className="text-ink-muted border-hairline border-b text-xs">
              <th
                scope="col"
                className="bg-surface sticky left-0 z-10 py-2 pr-3 text-left font-medium"
              >
                Canal
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Período
              </th>
              <th scope="col" className="hidden py-2 pr-3 text-right font-medium sm:table-cell">
                Meta implícita
              </th>
              <th scope="col" className="hidden py-2 pr-3 text-right font-medium sm:table-cell">
                vs meta
              </th>

              {weeks.map((week) => (
                <th
                  key={week.date}
                  scope="col"
                  title={week.partial ? 'Semana ainda em aberto' : undefined}
                  className="hidden py-2 pr-3 text-right font-medium lg:table-cell"
                >
                  {week.label}
                  {week.partial ? <span aria-hidden>*</span> : null}
                </th>
              ))}

              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Δ semana
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                base
              </th>
            </tr>
          </thead>

          <tbody className="tabular-nums">
            {rows.map((row) => (
              <ConversionRow
                key={row.channel}
                comparison={row.ratios[ratio]}
                label={labels[row.channel] ?? row.channel}
                color={colorOf(colors, row.channel)}
                weeks={weeks.map((week) => ({
                  value: week.channels[row.channel] ?? null,
                  base: week.bases[row.channel] ?? 0,
                }))}
                weekDelta={delta.channels[row.channel] ?? null}
                provisional={delta.provisional}
                focused={row.channel === highlight}
              />
            ))}
          </tbody>

          <tfoot className="border-hairline border-t tabular-nums">
            <ConversionRow
              comparison={total.ratios[ratio]}
              label={totalLabel}
              weeks={weeks.map((week) => ({ value: week.total, base: week.totalBase }))}
              weekDelta={delta.total}
              provisional={delta.provisional}
              emphasis
            />
          </tfoot>
        </table>
      </div>

      <p className="text-ink-muted text-xs">
        Razão entre etapas no período: {METRIC_LABELS[definition.numerator]} sobre{' '}
        {METRIC_LABELS[definition.denominator]} da mesma janela — numerador e denominador podem
        pertencer a semanas diferentes. As semanas são completas, então a primeira pode incluir dias
        anteriores ao início do período. <strong>base</strong> é o denominador do período: quanto
        menor, mais um único evento move a razão. <strong>—</strong> significa que não houve o que
        converter, nunca zero por cento.
        {weeks.some((week) => week.partial) ? ' * marca semana ainda em aberto.' : ''}
      </p>

      {gapNote ? <p className="text-ink-secondary text-xs">⚠ {gapNote}</p> : null}
    </div>
  )
}

/** Uma célula de semana: a razão e a base que a sustenta. */
interface WeekCell {
  value: number | null
  base: number
}

interface ConversionRowProps {
  comparison: RatioComparison
  label: string
  color?: string
  weeks: WeekCell[]
  weekDelta: number | null
  provisional: boolean
  emphasis?: boolean
  focused?: boolean
}

function ConversionRow({
  comparison,
  label,
  color,
  weeks,
  weekDelta,
  provisional,
  emphasis = false,
  focused = false,
}: ConversionRowProps) {
  // Base pequena não some da tela: fica em cinza, com o número do lado, para
  // quem lê decidir sozinho quanto peso dar à razão.
  const value = comparison.thin ? 'text-ink-muted' : 'text-ink'

  return (
    <tr className="border-hairline border-b last:border-0">
      <th
        scope="row"
        aria-current={focused ? 'true' : undefined}
        className={`bg-surface sticky left-0 z-10 py-2.5 pr-3 text-left font-medium ${
          emphasis || focused ? 'text-ink' : 'text-ink-secondary'
        }`}
      >
        <span className="flex items-center gap-2">
          {color ? (
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
          ) : null}
          <span>
            {label}
            {/* O destaque não pode viver só no peso da fonte. */}
            {focused ? (
              <span className="text-ink-muted block text-xs font-normal">em foco</span>
            ) : null}
          </span>
        </span>
      </th>

      <td className={`py-2.5 pr-3 text-right ${value}`}>
        {formatOptionalRatio(comparison.actual)}
      </td>
      <td className="text-ink-secondary hidden py-2.5 pr-3 text-right sm:table-cell">
        {formatOptionalRatio(comparison.benchmark)}
      </td>
      <td className="text-ink hidden py-2.5 pr-3 text-right sm:table-cell">
        {comparison.delta === null ? '—' : formatPoints(comparison.delta)}
      </td>

      {weeks.map((week, index) => {
        // Uma semana de base minúscula produz razões espetaculares e sem
        // significado — 50% sobre duas oportunidades. A célula não some: fica em
        // cinza, com a base no title, para não pesar igual a uma semana cheia.
        const frail = week.value !== null && week.base < BASE_MINIMA_SEMANAL

        return (
          <td
            key={index}
            title={week.base > 0 ? `base de ${formatCount(week.base)}` : undefined}
            className={`hidden py-2.5 pr-3 text-right lg:table-cell ${
              frail ? 'text-ink-muted' : 'text-ink-secondary'
            }`}
          >
            {formatOptionalRatio(week.value)}
          </td>
        )
      })}

      <td className="text-ink py-2.5 pr-3 text-right">
        {weekDelta === null ? (
          '—'
        ) : (
          <>
            {formatPoints(weekDelta)}
            {provisional ? (
              <span className="text-ink-muted" title="Semana ainda em aberto">
                {' '}
                <span aria-hidden>*</span>
              </span>
            ) : null}
          </>
        )}
      </td>
      <td
        className={`py-2.5 text-right ${comparison.thin ? 'text-ink-muted' : 'text-ink-secondary'}`}
      >
        {formatCount(comparison.base)}
      </td>
    </tr>
  )
}

/**
 * Por que o consolidado não tem conversão implícita na meta.
 *
 * Meta ausente vira aviso legível, nunca um número inventado — mesmo princípio
 * do "sem meta cadastrada" que a régua do período já mostra.
 */
function describeGap(
  comparison: RatioComparison,
  ratio: ConversionRatio,
  labels: Record<string, string>,
): string | null {
  const { numerator, denominator } = FUNNEL_RATIO_DEFINITIONS[ratio]

  switch (comparison.benchmarkGap) {
    case null:
      return null

    case 'sem-meta-numerador':
      return `sem conversão implícita na meta: falta meta de ${METRIC_LABELS[numerator]} no período`

    case 'sem-meta-denominador':
      return `sem conversão implícita na meta: falta meta de ${METRIC_LABELS[denominator]} no período`

    case 'meses-incompativeis':
      return `sem conversão implícita na meta: as metas de ${METRIC_LABELS[numerator]} e de ${METRIC_LABELS[denominator]} estão cadastradas em meses diferentes`

    case 'cobertura-parcial-de-canais': {
      const excluded = comparison.excludedChannels
        .map((channel) => labels[channel] ?? channel)
        .join(', ')

      return `sem conversão implícita na meta no consolidado: falta o par de metas para ${excluded}. Comparar o realizado de todos os canais contra a meta de parte deles daria um número errado.`
    }
  }
}
