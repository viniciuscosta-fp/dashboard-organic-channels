import {
  BASE_MINIMA_VALOR,
  type ChannelRatios,
  type RatioComparison,
} from '@/lib/data/funnel-efficiency'
import { FUNNEL_RATIO_DEFINITIONS, METRIC_LABELS } from '@/lib/data/types'
import { formatCount, formatRatioDelta, formatRatioValue } from '@/lib/format'
import { colorOf } from '@/lib/series-colors'

interface ChannelValueTableProps {
  /** Uma linha por canal, na ordem do cadastro. */
  rows: ChannelRatios[]
  /** Consolidado de todos os canais, exibido no rodapé. */
  total: ChannelRatios
  /** Cor de cada canal, pelo slot do grupo, para casar com os gráficos. */
  colors: Record<string, string>
  labels: Record<string, string>
  /** Canal em foco. A tabela segue completa; a linha dele é que se destaca. */
  highlight?: string | null
}

const TICKET = FUNNEL_RATIO_DEFINITIONS['average-ticket']
const POR_MQL = FUNNEL_RATIO_DEFINITIONS['revenue-per-mql']

/**
 * Quanto vale um cliente e quanto vale um MQL, por canal.
 *
 * Sem colunas de semana, de propósito. Um canal fecha poucos clientes por
 * semana, então "ticket médio da semana" seria um contrato único disfarçado de
 * média — e a pergunta que esta tabela responde ("qual canal vale mais
 * dinheiro") vive no nível do período, não no da semana.
 *
 * As duas colunas de valor não são independentes: receita por MQL é o ticket
 * médio multiplicado pela conversão de MQL para cliente. É o que separa "o canal
 * traz lead pior" de "o canal fecha contrato menor" — e a conversão que fecha a
 * conta está na tabela logo acima.
 */
export function ChannelValueTable({
  rows,
  total,
  colors,
  labels,
  highlight = null,
}: ChannelValueTableProps) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm sm:min-w-[34rem]">
          <caption className="sr-only">
            Ticket médio e receita por MQL de cada canal, no período
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
                Ticket médio
              </th>
              <th scope="col" className="hidden py-2 pr-3 text-right font-medium lg:table-cell">
                Meta implícita
              </th>
              <th scope="col" className="hidden py-2 pr-3 text-right font-medium sm:table-cell">
                vs meta
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Receita/MQL
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                clientes
              </th>
            </tr>
          </thead>

          <tbody className="tabular-nums">
            {rows.map((row) => (
              <ValueRow
                key={row.channel}
                ticket={row.ratios['average-ticket']}
                perMql={row.ratios['revenue-per-mql']}
                label={labels[row.channel] ?? row.channel}
                color={colorOf(colors, row.channel)}
                focused={row.channel === highlight}
              />
            ))}
          </tbody>

          <tfoot className="border-hairline border-t tabular-nums">
            <ValueRow
              ticket={total.ratios['average-ticket']}
              perMql={total.ratios['revenue-per-mql']}
              label="Consolidado"
              emphasis
            />
          </tfoot>
        </table>
      </div>

      <p className="text-ink-muted text-xs">
        Ticket médio é a receita do período dividida pelos clientes do período — a receita de um dia
        pertence aos clientes fechados naquele dia. <strong>Receita/MQL</strong> é o ticket médio
        multiplicado pela conversão de MQL para cliente: cair aqui pode ser contrato menor ou
        conversão pior, e a tabela acima diz qual dos dois. <strong>clientes</strong> é a base do
        ticket; abaixo de {formatCount(BASE_MINIMA_VALOR)}, o número sai em cinza porque uma média
        de tão poucos contratos é um contrato. <strong>—</strong> significa que não houve cliente
        fechado.
      </p>
    </div>
  )
}

interface ValueRowProps {
  ticket: RatioComparison
  perMql: RatioComparison
  label: string
  color?: string
  focused?: boolean
  emphasis?: boolean
}

function ValueRow({
  ticket,
  perMql,
  label,
  color,
  focused = false,
  emphasis = false,
}: ValueRowProps) {
  // O benchmark de receita por MQL existe, mas não ganha coluna: ele é
  // consequência do ticket e da conversão, que já têm as suas. Fica no title
  // para quem for atrás.
  const perMqlHint =
    perMql.benchmark === null
      ? `sobre ${formatCount(perMql.base)} ${METRIC_LABELS.mqls}`
      : `${formatCount(perMql.base)} ${METRIC_LABELS.mqls} · meta implícita ${formatRatioValue(
          POR_MQL.unit,
          perMql.benchmark,
        )}`

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

      <td className={`py-2.5 pr-3 text-right ${ticket.thin ? 'text-ink-muted' : 'text-ink'}`}>
        {formatRatioValue(TICKET.unit, ticket.actual)}
      </td>
      <td className="text-ink-secondary hidden py-2.5 pr-3 text-right lg:table-cell">
        {formatRatioValue(TICKET.unit, ticket.benchmark)}
      </td>
      <td className="text-ink hidden py-2.5 pr-3 text-right sm:table-cell">
        {formatRatioDelta(TICKET.unit, ticket.delta)}
      </td>
      <td className="text-ink-secondary py-2.5 pr-3 text-right" title={perMqlHint}>
        {formatRatioValue(POR_MQL.unit, perMql.actual)}
      </td>
      <td className={`py-2.5 text-right ${ticket.thin ? 'text-ink-muted' : 'text-ink-secondary'}`}>
        {formatCount(ticket.base)}
      </td>
    </tr>
  )
}
