import Link from 'next/link'

import type { ChannelSection } from '@/lib/data/channel-catalog'
import { colorOf } from '@/lib/series-colors'

interface ChannelPickerProps {
  /** Canais do catálogo, na ordem canônica, já divididos por grupo. */
  sections: ChannelSection[]
  /** Canal em foco, ou `null` para o consolidado. */
  current: string | null
  /** Parâmetros dos outros eixos, preservados ao trocar de canal. */
  baseQuery: Record<string, string>
  /** Cor de cada canal, para o ponto casar com o dos gráficos e tabelas. */
  colors: Record<string, string>
}

/**
 * Escolhe o canal em foco.
 *
 * Seleção única: o gesto natural depois de ver um canal em risco na tabela é
 * abrir aquele canal, não montar um subconjunto. `FunnelQuery.channels` é uma
 * lista, então a porta para multisseleção fica aberta sem mexer na camada de
 * dados.
 *
 * Segue o padrão do seletor de período: links, sem JavaScript, e o estado
 * inteiro compartilhável por URL.
 *
 * Com dez ou mais canais, uma fileira única de pílulas passava de duas linhas
 * sem ordem nenhuma. Agora cada grupo tem a sua linha, com o nome do grupo à
 * esquerda — é o que permite achar um canal pela família dele.
 *
 * O ponto de cor diz o grupo; o rótulo ao lado diz o canal. Nada aqui depende
 * de distinguir matizes.
 */
export function ChannelPicker({ sections, current, baseQuery, colors }: ChannelPickerProps) {
  const pill = (active: boolean) =>
    active
      ? 'bg-ink text-surface flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium'
      : 'ring-hairline text-ink-secondary hover:text-ink flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ring-1'

  const hasGroups = sections.some((section) => section.label !== null)

  return (
    <nav aria-label="Canal" className="space-y-1.5">
      <ul className="flex flex-wrap gap-1.5">
        <li>
          <Link
            href={{ pathname: '/', query: baseQuery }}
            aria-current={current === null ? 'page' : undefined}
            className={pill(current === null)}
          >
            Todos os canais
          </Link>
        </li>

        {/* Sem grupos cadastrados, os canais seguem na mesma fileira de antes. */}
        {hasGroups
          ? null
          : sections
              .flatMap((section) => section.channels)
              .map((channel) => (
                <li key={channel.channel}>
                  <ChannelLink
                    channel={channel.channel}
                    label={channel.label}
                    color={colorOf(colors, channel.channel)}
                    active={channel.channel === current}
                    baseQuery={baseQuery}
                    className={pill(channel.channel === current)}
                  />
                </li>
              ))}
      </ul>

      {hasGroups
        ? sections.map((section, index) => (
            <div
              key={section.label ?? `sem-grupo-${index}`}
              className="flex flex-col gap-1.5 sm:flex-row sm:items-start"
            >
              <span className="text-ink-muted shrink-0 pt-1.5 text-xs sm:w-24">
                {section.label ?? 'Sem grupo'}
              </span>
              <ul className="flex flex-wrap gap-1.5" aria-label={section.label ?? 'Sem grupo'}>
                {section.channels.map((channel) => (
                  <li key={channel.channel}>
                    <ChannelLink
                      channel={channel.channel}
                      label={channel.label}
                      color={colorOf(colors, channel.channel)}
                      active={channel.channel === current}
                      baseQuery={baseQuery}
                      className={pill(channel.channel === current)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))
        : null}
    </nav>
  )
}

interface ChannelLinkProps {
  channel: string
  label: string
  color: string
  active: boolean
  baseQuery: Record<string, string>
  className: string
}

function ChannelLink({ channel, label, color, active, baseQuery, className }: ChannelLinkProps) {
  return (
    <Link
      href={{ pathname: '/', query: { ...baseQuery, canal: channel } }}
      aria-current={active ? 'page' : undefined}
      className={className}
    >
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </Link>
  )
}
