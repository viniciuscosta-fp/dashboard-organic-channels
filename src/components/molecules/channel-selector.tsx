import Link from 'next/link'

import type { ChannelSection } from '@/lib/data/channel-catalog'
import { colorOf } from '@/lib/series-colors'

/** Um grupo no menu, com os links já montados pela rota. */
export interface SelectorGroup {
  name: string
  /** Quantos canais o grupo soma. */
  size: number
  source: 'planilha' | 'personalizado'
  active: boolean
  href: Record<string, string>
  /** Link que remove o grupo. Só existe para grupo personalizado. */
  removeHref: Record<string, string> | null
}

interface ChannelSelectorProps {
  /** Texto do botão: o que está selecionado agora. */
  currentLabel: string
  /** Estado dos outros eixos, sem canal nem grupo — a base de todo link daqui. */
  baseQuery: Record<string, string>
  groups: SelectorGroup[]
  /** Canais na ordem canônica, divididos pelos grupos da planilha. */
  sections: ChannelSection[]
  /** Canal em foco, ou `null`. */
  currentChannel: string | null
  /** `true` quando nem canal nem grupo estão selecionados. */
  allSelected: boolean
  colors: Record<string, string>
}

/**
 * Escolhe o que o dashboard mostra: todos os canais, um grupo ou um canal.
 *
 * Menu suspenso em vez de fileiras de pílulas: com doze ou quinze canais, as
 * pílulas tomavam quatro linhas do topo para um controle que se usa uma vez por
 * leitura. `<details>` abre e fecha sem JavaScript, e cada item é um link — o
 * estado continua inteiro na URL, compartilhável, como no seletor de período.
 *
 * O `key` em `<details>` vem da seleção atual: ao navegar, o React remonta o
 * elemento e o menu volta fechado, em vez de ficar aberto sobre a tela nova.
 */
export function ChannelSelector({
  currentLabel,
  baseQuery,
  groups,
  sections,
  currentChannel,
  allSelected,
  colors,
}: ChannelSelectorProps) {
  const item = (active: boolean) =>
    `flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
      active
        ? 'bg-ink text-surface font-medium'
        : 'text-ink-secondary hover:bg-hairline hover:text-ink'
    }`

  return (
    <details key={currentLabel} className="group relative">
      <summary className="ring-hairline text-ink hover:bg-hairline flex cursor-pointer list-none items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ring-1 [&::-webkit-details-marker]:hidden">
        {currentLabel}
        <span aria-hidden className="text-ink-muted transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>

      <div className="bg-surface ring-hairline absolute left-0 z-20 mt-2 max-h-[70vh] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto rounded-xl p-3 shadow-lg ring-1">
        <nav
          aria-label="Canal ou grupo"
          className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
        >
          <div className="space-y-3">
            <Link
              href={{ pathname: '/', query: baseQuery }}
              aria-current={allSelected ? 'page' : undefined}
              className={item(allSelected)}
            >
              Todos os canais
            </Link>

            <section className="space-y-1">
              <h3 className="text-ink-muted px-2 text-xs font-medium">Grupos</h3>
              {groups.length === 0 ? (
                <p className="text-ink-muted px-2 text-xs">
                  Nenhum grupo ainda. Use “Criar grupo” ao lado.
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {groups.map((group) => (
                    <li key={group.name} className="flex items-center gap-1">
                      <Link
                        href={{ pathname: '/', query: group.href }}
                        aria-current={group.active ? 'page' : undefined}
                        className={item(group.active)}
                      >
                        <span className="min-w-0 flex-1 truncate">{group.name}</span>
                        <span className={group.active ? 'text-surface' : 'text-ink-muted'}>
                          {group.size} {group.size === 1 ? 'canal' : 'canais'}
                          {group.source === 'personalizado' ? ' · seu' : ''}
                        </span>
                      </Link>
                      {group.removeHref ? (
                        <Link
                          href={{ pathname: '/', query: group.removeHref }}
                          aria-label={`Remover o grupo ${group.name}`}
                          title="Remover grupo"
                          className="text-ink-muted hover:text-ink rounded-md px-1.5 py-1 text-xs"
                        >
                          ✕
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="space-y-2">
            <h3 className="text-ink-muted px-2 text-xs font-medium">Canais</h3>
            {sections.map((section, index) => (
              <div key={section.label ?? `sem-grupo-${index}`} className="space-y-0.5">
                {section.label ? (
                  <p className="text-ink-muted px-2 pt-1 text-[11px] tracking-wide uppercase">
                    {section.label}
                  </p>
                ) : null}
                <ul className="space-y-0.5">
                  {section.channels.map((channel) => {
                    const active = channel.channel === currentChannel

                    return (
                      <li key={channel.channel}>
                        <Link
                          href={{ pathname: '/', query: { ...baseQuery, canal: channel.channel } }}
                          aria-current={active ? 'page' : undefined}
                          className={item(active)}
                        >
                          <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: colorOf(colors, channel.channel) }}
                          />
                          <span className="truncate">{channel.label}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </section>
        </nav>
      </div>
    </details>
  )
}
