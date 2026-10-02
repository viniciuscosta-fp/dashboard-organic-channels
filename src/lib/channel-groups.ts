import type { ChannelCatalog, ChannelSection } from './data/channel-catalog'

/**
 * Grupos de canais: os prontos, vindos da coluna `group` da planilha, e os
 * personalizados, criados na tela.
 *
 * Os personalizados vivem **na URL** (`?grupos=`), não num banco: o link é a
 * persistência. Recarregar mantém, compartilhar leva junto, e a rota recalcula
 * tudo a partir dele — como já faz com período, métrica e canal. Ver
 * docs/decisions/0010.
 *
 * Formato de `grupos`: `nome~canal,canal|nome~canal`. Chave de canal é
 * `[A-Za-z0-9_-]`, então `,` nunca aparece nela; `|` e `~` são proibidos no
 * nome, e é isso que torna o formato inequívoco.
 */

/** Grupo personalizado como mora na URL: nome e chaves de canal, ainda sem validar. */
export interface CustomGroup {
  name: string
  channels: string[]
}

/** Grupo pronto para o seletor, com os canais já reconciliados contra o catálogo. */
export interface SelectableGroup {
  name: string
  /** Canais do grupo, na ordem canônica do catálogo. */
  channels: string[]
  source: 'planilha' | 'personalizado'
}

/** Teto de grupos personalizados: a URL é a persistência, e precisa caber num link. */
export const MAX_CUSTOM_GROUPS = 10

/** Tamanho máximo do nome, para caber no botão do seletor. */
export const MAX_GROUP_NAME_LENGTH = 40

/** Por que a criação de um grupo foi recusada. Vai para a URL como `?aviso=`. */
export type GroupCreationError =
  'grupo-sem-nome' | 'grupo-sem-canais' | 'grupo-repetido' | 'limite-de-grupos'

export const GROUP_CREATION_MESSAGES: Record<GroupCreationError, string> = {
  'grupo-sem-nome': 'Dê um nome ao grupo.',
  'grupo-sem-canais': 'Marque pelo menos um canal para o grupo.',
  'grupo-repetido': 'Já existe um grupo com esse nome.',
  'limite-de-grupos': `O limite é de ${MAX_CUSTOM_GROUPS} grupos personalizados. Remova um para criar outro.`,
}

export function isGroupCreationError(value: unknown): value is GroupCreationError {
  return typeof value === 'string' && value in GROUP_CREATION_MESSAGES
}

/**
 * Nome limpo: sem os separadores do formato, sem espaço sobrando, com teto de
 * tamanho. Devolve `''` quando não sobra nada.
 */
export function normalizeGroupName(name: string): string {
  return name
    .replace(/[|~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_GROUP_NAME_LENGTH)
    .trim()
}

/** Identidade de um nome de grupo: sem diferenciar caixa, como a coluna `group`. */
export function groupKey(name: string): string {
  return normalizeGroupName(name).toLocaleLowerCase('pt-BR')
}

/**
 * Lê `?grupos=`. Trecho malformado é descartado em silêncio, como o resto da URL:
 * um link colado pela metade não pode derrubar o dashboard.
 */
export function parseCustomGroups(raw: string | undefined): CustomGroup[] {
  if (!raw) return []

  const groups: CustomGroup[] = []
  const seen = new Set<string>()

  for (const chunk of raw.split('|')) {
    const separator = chunk.lastIndexOf('~')
    if (separator === -1) continue

    const name = normalizeGroupName(chunk.slice(0, separator))
    const channels = [
      ...new Set(
        chunk
          .slice(separator + 1)
          .split(',')
          .map((channel) => channel.trim())
          .filter((channel) => /^[A-Za-z0-9_-]+$/.test(channel)),
      ),
    ]

    if (name === '' || channels.length === 0 || seen.has(groupKey(name))) continue

    seen.add(groupKey(name))
    groups.push({ name, channels })
  }

  return groups.slice(0, MAX_CUSTOM_GROUPS)
}

/** Inverso de `parseCustomGroups`. Lista vazia vira `''`, para o parâmetro sumir. */
export function serializeCustomGroups(groups: readonly CustomGroup[]): string {
  return groups.map((group) => `${group.name}~${group.channels.join(',')}`).join('|')
}

/**
 * Grupos que o seletor oferece: primeiro os da planilha, depois os
 * personalizados, todos com os canais reconciliados contra o catálogo.
 *
 * Canal que não existe mais é tirado do grupo; grupo que fica vazio some.
 * Personalizado com o nome de um da planilha também some — não pode haver dois
 * "Pago" no menu, e a planilha é a referência do time.
 */
export function selectableGroups(
  catalog: ChannelCatalog,
  custom: readonly CustomGroup[],
): SelectableGroup[] {
  const order = catalog.channels.map((entry) => entry.channel)
  const inOrder = (channels: readonly string[]) =>
    order.filter((channel) => channels.includes(channel))

  const fromSheet: SelectableGroup[] = catalog.groups
    .filter((group) => group.label !== null)
    .map((group) => ({
      name: group.label!,
      channels: catalog.channels
        .filter((entry) => entry.group.key === group.key)
        .map((entry) => entry.channel),
      source: 'planilha' as const,
    }))

  const taken = new Set(fromSheet.map((group) => groupKey(group.name)))

  const personal = custom
    .filter((group) => !taken.has(groupKey(group.name)))
    .map((group) => ({
      name: group.name,
      channels: inOrder(group.channels),
      source: 'personalizado' as const,
    }))
    .filter((group) => group.channels.length > 0)

  return [...fromSheet, ...personal]
}

/** Grupo escolhido em `?grupo=`, ou `null` se o nome não corresponder a nenhum. */
export function resolveGroupParam(
  name: string | null,
  groups: readonly SelectableGroup[],
): SelectableGroup | null {
  if (name === null) return null
  const key = groupKey(name)
  return groups.find((group) => groupKey(group.name) === key) ?? null
}

/** Pedido de criação, como chega do formulário. */
export interface GroupCreationInput {
  name: string
  channels: readonly string[]
}

export type GroupCreationResult =
  | { ok: true; groups: CustomGroup[]; created: CustomGroup }
  | { ok: false; error: GroupCreationError }

/**
 * Acrescenta um grupo personalizado, ou diz por que não.
 *
 * Valida contra o que existe de fato: canais do cadastro e nomes já em uso,
 * da planilha ou personalizados.
 */
export function addCustomGroup(
  existing: readonly CustomGroup[],
  input: GroupCreationInput,
  context: { knownChannels: readonly string[]; takenNames: readonly string[] },
): GroupCreationResult {
  const name = normalizeGroupName(input.name)
  if (name === '') return { ok: false, error: 'grupo-sem-nome' }

  const channels = context.knownChannels.filter((channel) => input.channels.includes(channel))
  if (channels.length === 0) return { ok: false, error: 'grupo-sem-canais' }

  const taken = new Set(
    [...context.takenNames, ...existing.map((group) => group.name)].map(groupKey),
  )
  if (taken.has(groupKey(name))) return { ok: false, error: 'grupo-repetido' }

  if (existing.length >= MAX_CUSTOM_GROUPS) return { ok: false, error: 'limite-de-grupos' }

  const created = { name, channels }
  return { ok: true, groups: [...existing, created], created }
}

/** Campos do formulário de criação. Não usam `canal` para não colidir com o eixo de foco. */
export const GROUP_FORM_FIELDS = { name: 'novo_nome', channel: 'novo_canal' } as const

/** Parâmetros que a criação recalcula, em vez de repassar como vieram. */
const RECOMPUTED = new Set<string>([
  GROUP_FORM_FIELDS.name,
  GROUP_FORM_FIELDS.channel,
  'grupos',
  'grupo',
  'canal',
  'aviso',
])

/**
 * URL de destino depois de enviar o formulário de criação.
 *
 * O formulário é um `GET` comum — sem JavaScript, como o resto dos controles —,
 * e manda junto, em campos ocultos, o estado atual do dashboard. Daqui sai a
 * query final: o estado repassado como veio, mais `grupos` atualizado e o grupo
 * novo já selecionado. Se a criação for recusada, os grupos ficam como estavam
 * e `aviso` diz por quê.
 */
export function groupCreationQuery(
  entries: Iterable<[string, string]>,
  context: { knownChannels: readonly string[]; takenNames: readonly string[] },
): Record<string, string> {
  const all = [...entries]
  const first = (key: string) => all.find(([name]) => name === key)?.[1]

  const query: Record<string, string> = {}
  for (const [key, value] of all) {
    if (!RECOMPUTED.has(key) && !(key in query)) query[key] = value
  }

  const existing = parseCustomGroups(first('grupos'))
  const result = addCustomGroup(
    existing,
    {
      name: first(GROUP_FORM_FIELDS.name) ?? '',
      channels: all.filter(([key]) => key === GROUP_FORM_FIELDS.channel).map(([, value]) => value),
    },
    context,
  )

  const groups = result.ok ? result.groups : existing
  if (groups.length > 0) query.grupos = serializeCustomGroups(groups)

  if (result.ok) {
    query.grupo = result.created.name
  } else {
    query.aviso = result.error
  }

  return query
}

/** Tira um grupo personalizado pelo nome, sem diferenciar caixa. */
export function removeCustomGroup(groups: readonly CustomGroup[], name: string): CustomGroup[] {
  const key = groupKey(name)
  return groups.filter((group) => groupKey(group.name) !== key)
}

/**
 * Restringe as seções de canais a um conjunto, mantendo a ordem e descartando
 * seção que fica vazia. É o que faz a evolução por canal mostrar só o grupo.
 */
export function restrictSections(
  sections: readonly ChannelSection[],
  channels: ReadonlySet<string>,
): ChannelSection[] {
  return sections
    .map((section) => ({
      ...section,
      channels: section.channels.filter((entry) => channels.has(entry.channel)),
    }))
    .filter((section) => section.channels.length > 0)
}
