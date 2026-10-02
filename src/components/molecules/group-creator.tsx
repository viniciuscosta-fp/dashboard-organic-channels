import type { ChannelSection } from '@/lib/data/channel-catalog'
import { colorOf } from '@/lib/series-colors'

interface GroupCreatorProps {
  /** Estado atual do dashboard, repassado em campos ocultos. Inclui `grupos`. */
  baseQuery: Record<string, string>
  sections: ChannelSection[]
  colors: Record<string, string>
  /** Nomes dos campos, definidos junto com quem os lê. */
  fields: { name: string; channel: string }
  maxNameLength: number
  /** Por que a última tentativa foi recusada, ou `null`. */
  warning: string | null
}

/**
 * Cria um grupo personalizado: um nome e os canais que ele soma.
 *
 * Formulário `GET` comum, sem JavaScript, enviado para `/grupos`, que devolve a
 * URL do dashboard com o grupo gravado e já selecionado. Não há gravação em
 * lugar nenhum — o grupo vive na URL, então salvar o link salva o grupo.
 *
 * Com aviso da tentativa anterior, o menu já abre mostrando o motivo.
 */
export function GroupCreator({
  baseQuery,
  sections,
  colors,
  fields,
  maxNameLength,
  warning,
}: GroupCreatorProps) {
  return (
    <details open={warning !== null} className="group relative">
      <summary className="ring-hairline text-ink-secondary hover:text-ink hover:bg-hairline flex cursor-pointer list-none items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ring-1 [&::-webkit-details-marker]:hidden">
        <span aria-hidden>+</span> Criar grupo
      </summary>

      <form
        method="get"
        action="/grupos"
        className="bg-surface ring-hairline absolute left-0 z-20 mt-2 max-h-[70vh] w-[min(32rem,calc(100vw-2rem))] space-y-3 overflow-y-auto rounded-xl p-4 shadow-lg ring-1"
      >
        {Object.entries(baseQuery).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}

        <label className="text-ink-secondary flex flex-col gap-1 text-xs">
          Nome do grupo
          <input
            type="text"
            name={fields.name}
            required
            maxLength={maxNameLength}
            placeholder="ex.: Pago, Marca, Conteúdo"
            className="bg-surface ring-hairline text-ink rounded-md px-2 py-1.5 text-sm ring-1"
          />
        </label>

        <fieldset className="space-y-2">
          <legend className="text-ink-secondary mb-1 text-xs">Canais do grupo</legend>
          {sections.map((section, index) => (
            <div key={section.label ?? `sem-grupo-${index}`} className="space-y-1">
              {section.label ? (
                <p className="text-ink-muted text-[11px] tracking-wide uppercase">
                  {section.label}
                </p>
              ) : null}
              <div className="grid gap-x-3 gap-y-1 sm:grid-cols-2">
                {section.channels.map((channel) => (
                  <label
                    key={channel.channel}
                    className="text-ink-secondary hover:text-ink flex items-center gap-2 text-xs"
                  >
                    <input type="checkbox" name={fields.channel} value={channel.channel} />
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: colorOf(colors, channel.channel) }}
                    />
                    <span className="truncate">{channel.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </fieldset>

        {warning ? (
          <p role="alert" className="text-ink text-xs">
            <span aria-hidden>⚠ </span>
            {warning}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <p className="text-ink-muted text-xs">
            O grupo fica no link da página: salve o link para guardá-lo.
          </p>
          <button
            type="submit"
            className="bg-ink text-surface shrink-0 rounded-md px-3 py-1.5 text-xs font-medium"
          >
            Criar e selecionar
          </button>
        </div>
      </form>
    </details>
  )
}
