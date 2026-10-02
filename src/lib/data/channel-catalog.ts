import type { ChannelInfo } from './types'

/**
 * Família de canais, como aparece na tela.
 *
 * Canal sem grupo cadastrado vira um grupo de um canal só, com `label: null`.
 * Assim a regra de cor — um slot por grupo — continua valendo para a planilha
 * que ainda não tem a coluna `group`: cada canal fica com o próprio slot, como
 * era antes do agrupamento. Ver docs/decisions/0009.
 */
export interface ChannelGroup {
  /** Identidade estável do grupo. Não é exibida. */
  key: string
  /** Nome exibido, ou `null` para canal sem grupo. */
  label: string | null
}

/** Um canal pronto para a tela: chave, nome exibido, grupo e se está cadastrado. */
export interface ResolvedChannel {
  channel: string
  label: string
  group: ChannelGroup
  /** `false` quando o canal apareceu no funil mas não está na aba `canais`. */
  registered: boolean
}

export interface ChannelCatalog {
  /** Canais na ordem canônica: agrupados, e dentro do grupo pela ordem do cadastro. */
  channels: ResolvedChannel[]
  /** Grupos na ordem em que aparecem em `channels`. */
  groups: ChannelGroup[]
  /** Chaves vistas no funil e ausentes do cadastro, para avisar na interface. */
  unregistered: string[]
}

/** Trecho contínuo da lista de canais sob o mesmo título de grupo. */
export interface ChannelSection {
  /** Nome do grupo, ou `null` para uma sequência de canais sem grupo. */
  label: string | null
  channels: ResolvedChannel[]
}

function singletonGroup(channel: string): ChannelGroup {
  return { key: `canal:${channel}`, label: null }
}

/**
 * Cruza o cadastro de canais com o que apareceu nos dados.
 *
 * Canal cadastrado sem dado no período **aparece zerado**: estar em zero é
 * informação, e some-lo esconderia justamente o canal que precisa de atenção.
 *
 * Canal com dado e sem cadastro também aparece, com a chave crua como rótulo e
 * registrado em `unregistered` — mesmo princípio do mês sem meta: a ausência
 * vira aviso visível, nunca dado descartado em silêncio.
 *
 * A ordem canônica junta os canais de um mesmo grupo, mesmo que o cadastro os
 * intercale: o grupo entra na posição do seu primeiro canal. É a ordem que toda
 * a tela usa — seletor, gráficos e tabelas —, então a cor e o lugar de um canal
 * nunca discordam entre dois blocos.
 */
export function resolveChannels(
  registered: readonly ChannelInfo[],
  seenInData: readonly string[],
): ChannelCatalog {
  const byKey = new Map(registered.map((info) => [info.channel, info]))

  const unregistered = [...new Set(seenInData)].filter((key) => !byKey.has(key)).sort()

  // Grupo identificado sem diferenciar caixa nem espaços: "Pago" e "pago " na
  // planilha são o mesmo grupo. O nome exibido é o da primeira ocorrência.
  const groupsByKey = new Map<string, ChannelGroup>()

  const resolved: ResolvedChannel[] = registered.map((info) => {
    const label = info.group?.trim() ?? ''
    let group = singletonGroup(info.channel)

    if (label !== '') {
      const key = `grupo:${label.toLocaleLowerCase('pt-BR')}`
      group = groupsByKey.get(key) ?? { key, label }
      groupsByKey.set(key, group)
    }

    return { channel: info.channel, label: info.label, group, registered: true }
  })

  const groupRank = new Map<string, number>()
  for (const entry of resolved) {
    if (!groupRank.has(entry.group.key)) groupRank.set(entry.group.key, groupRank.size)
  }

  // `sort` é estável: dentro do grupo, a ordem do cadastro se mantém.
  resolved.sort((a, b) => groupRank.get(a.group.key)! - groupRank.get(b.group.key)!)

  const channels: ResolvedChannel[] = [
    ...resolved,
    ...unregistered.map((channel) => ({
      channel,
      label: channel,
      group: singletonGroup(channel),
      registered: false,
    })),
  ]

  const groups = [...new Map(channels.map((entry) => [entry.group.key, entry.group])).values()]

  return { channels, groups, unregistered }
}

/** Consulta rápida de rótulo, com a chave crua como reserva. */
export function labelOf(catalog: ChannelCatalog, channel: string): string {
  return catalog.channels.find((entry) => entry.channel === channel)?.label ?? channel
}

/** Nome do grupo de um canal, ou `null` se não tiver grupo ou não estiver no catálogo. */
export function groupLabelOf(catalog: ChannelCatalog, channel: string): string | null {
  return catalog.channels.find((entry) => entry.channel === channel)?.group.label ?? null
}

/**
 * Divide os canais em trechos para exibir com título de grupo.
 *
 * Canais sem grupo vizinhos ficam num mesmo trecho sem título, em vez de cada
 * um ganhar uma seção de um item só. Com a planilha sem coluna `group`, o
 * resultado é um trecho único — a tela fica como era antes do agrupamento.
 */
export function groupSections(catalog: ChannelCatalog): ChannelSection[] {
  const sections: ChannelSection[] = []

  for (const entry of catalog.channels) {
    const last = sections.at(-1)
    const label = entry.group.label

    const sameSection =
      last !== undefined &&
      (label === null ? last.label === null : last.channels[0].group.key === entry.group.key)

    if (sameSection) {
      last.channels.push(entry)
    } else {
      sections.push({ label, channels: [entry] })
    }
  }

  return sections
}
