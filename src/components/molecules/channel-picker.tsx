import Link from 'next/link'

import type { ResolvedChannel } from '@/lib/data/channel-catalog'
import { seriesColorOf } from '@/lib/series-colors'

interface ChannelPickerProps {
  /** Canais do catálogo, na ordem do cadastro. */
  channels: ResolvedChannel[]
  /** Canal em foco, ou `null` para o consolidado. */
  current: string | null
  /** Parâmetros dos outros eixos, preservados ao trocar de canal. */
  baseQuery: Record<string, string>
  /** Ordem canônica, para o ponto de cor casar com o dos gráficos e tabelas. */
  order: string[]
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
 * O ponto de cor não é decoração — é onde se aprende o par canal↔cor que os
 * gráficos e as tabelas usam. O rótulo ao lado carrega a mesma informação em
 * texto, então nada aqui depende de distinguir matizes.
 */
export function ChannelPicker({ channels, current, baseQuery, order }: ChannelPickerProps) {
  const pill = (active: boolean) =>
    active
      ? 'bg-ink text-surface flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium'
      : 'ring-hairline text-ink-secondary hover:text-ink flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ring-1'

  return (
    <nav aria-label="Canal">
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

        {channels.map((channel) => {
          const active = channel.channel === current

          return (
            <li key={channel.channel}>
              <Link
                href={{ pathname: '/', query: { ...baseQuery, canal: channel.channel } }}
                aria-current={active ? 'page' : undefined}
                className={pill(active)}
              >
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: seriesColorOf(order, channel.channel) }}
                />
                {channel.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
