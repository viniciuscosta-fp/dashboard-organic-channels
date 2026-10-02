import { describe, expect, it } from 'vitest'

import {
  addCustomGroup,
  groupCreationQuery,
  groupKey,
  MAX_CUSTOM_GROUPS,
  normalizeGroupName,
  parseCustomGroups,
  removeCustomGroup,
  resolveGroupParam,
  restrictSections,
  selectableGroups,
  serializeCustomGroups,
  type CustomGroup,
} from './channel-groups'
import { groupSections, resolveChannels } from './data/channel-catalog'
import type { ChannelInfo } from './data/types'

const registered: ChannelInfo[] = [
  { channel: 'site', label: 'Site', order: 1, group: 'Orgânico' },
  { channel: 'blog', label: 'Blog', order: 2, group: 'Orgânico' },
  { channel: 'busca_paga', label: 'Busca paga', order: 3, group: 'Pago' },
  { channel: 'social_pago', label: 'Social pago', order: 4, group: 'Pago' },
  { channel: 'ia', label: 'IA', order: 5 },
]

const catalog = resolveChannels(registered, [])
const known = catalog.channels.map((entry) => entry.channel)

describe('normalizeGroupName', () => {
  it('apara, colapsa espaços e troca os separadores do formato', () => {
    expect(normalizeGroupName('  Meu |  grupo~x ')).toBe('Meu grupo x')
  })

  it('corta no tamanho máximo', () => {
    expect(normalizeGroupName('a'.repeat(60))).toHaveLength(40)
  })

  it('devolve vazio quando só há separadores e espaço', () => {
    expect(normalizeGroupName(' | ~ ')).toBe('')
  })
})

describe('groupKey', () => {
  it('não diferencia caixa nem espaços nas bordas', () => {
    expect(groupKey(' Pago ')).toBe(groupKey('pago'))
  })
})

describe('parseCustomGroups', () => {
  it('lê nome e canais de cada grupo', () => {
    expect(parseCustomGroups('Pago~busca_paga,social_pago|IA~ia')).toEqual([
      { name: 'Pago', channels: ['busca_paga', 'social_pago'] },
      { name: 'IA', channels: ['ia'] },
    ])
  })

  it('devolve vazio sem parâmetro', () => {
    expect(parseCustomGroups(undefined)).toEqual([])
    expect(parseCustomGroups('')).toEqual([])
  })

  it('descarta trecho sem separador, sem nome ou sem canal válido', () => {
    expect(parseCustomGroups('sem-separador|~ia|Vazio~|Ruim~a b,c$d|Bom~ia')).toEqual([
      { name: 'Bom', channels: ['ia'] },
    ])
  })

  it('remove canal repetido dentro do grupo', () => {
    expect(parseCustomGroups('X~ia,ia,blog')).toEqual([{ name: 'X', channels: ['ia', 'blog'] }])
  })

  it('mantém só o primeiro de dois grupos com o mesmo nome', () => {
    expect(parseCustomGroups('Pago~ia|pago~blog')).toEqual([{ name: 'Pago', channels: ['ia'] }])
  })

  it(`não passa de ${MAX_CUSTOM_GROUPS} grupos`, () => {
    const raw = Array.from({ length: 12 }, (_, i) => `G${i}~ia`).join('|')

    expect(parseCustomGroups(raw)).toHaveLength(MAX_CUSTOM_GROUPS)
  })

  it('faz ida e volta com serializeCustomGroups', () => {
    const groups: CustomGroup[] = [
      { name: 'Pago', channels: ['busca_paga'] },
      { name: 'Tudo de IA', channels: ['ia', 'blog'] },
    ]

    expect(parseCustomGroups(serializeCustomGroups(groups))).toEqual(groups)
  })
})

describe('selectableGroups', () => {
  it('lista os grupos da planilha antes dos personalizados', () => {
    const groups = selectableGroups(catalog, [{ name: 'Minha seleção', channels: ['ia', 'site'] }])

    expect(groups.map((g) => [g.name, g.source])).toEqual([
      ['Orgânico', 'planilha'],
      ['Pago', 'planilha'],
      ['Minha seleção', 'personalizado'],
    ])
  })

  it('põe os canais do grupo personalizado na ordem canônica', () => {
    const [, , mine] = selectableGroups(catalog, [{ name: 'Mix', channels: ['ia', 'site'] }])

    expect(mine.channels).toEqual(['site', 'ia'])
  })

  it('tira canal que não existe mais e descarta grupo que fica vazio', () => {
    const groups = selectableGroups(catalog, [
      { name: 'Parcial', channels: ['ia', 'canal_extinto'] },
      { name: 'Fantasma', channels: ['canal_extinto'] },
    ])

    expect(groups.find((g) => g.name === 'Parcial')?.channels).toEqual(['ia'])
    expect(groups.some((g) => g.name === 'Fantasma')).toBe(false)
  })

  it('descarta personalizado com o nome de um grupo da planilha', () => {
    const groups = selectableGroups(catalog, [{ name: 'pago', channels: ['ia'] }])

    expect(groups.filter((g) => groupKey(g.name) === 'pago')).toHaveLength(1)
    expect(groups.find((g) => groupKey(g.name) === 'pago')?.source).toBe('planilha')
  })

  it('sem coluna de grupo na planilha, só existem os personalizados', () => {
    const plain = resolveChannels(
      registered.map((info) => ({ channel: info.channel, label: info.label, order: info.order })),
      [],
    )

    expect(selectableGroups(plain, [])).toEqual([])
  })
})

describe('resolveGroupParam', () => {
  const groups = selectableGroups(catalog, [])

  it('encontra o grupo pelo nome, sem diferenciar caixa', () => {
    expect(resolveGroupParam('pago', groups)?.name).toBe('Pago')
  })

  it('devolve null para nome desconhecido ou ausente', () => {
    expect(resolveGroupParam('Inexistente', groups)).toBeNull()
    expect(resolveGroupParam(null, groups)).toBeNull()
  })
})

describe('addCustomGroup', () => {
  const context = { knownChannels: known, takenNames: ['Orgânico', 'Pago'] }

  it('cria o grupo com os canais conhecidos, na ordem canônica', () => {
    const result = addCustomGroup([], { name: ' Mix ', channels: ['ia', 'site', 'xyz'] }, context)

    expect(result).toEqual({
      ok: true,
      created: { name: 'Mix', channels: ['site', 'ia'] },
      groups: [{ name: 'Mix', channels: ['site', 'ia'] }],
    })
  })

  it('recusa nome vazio', () => {
    expect(addCustomGroup([], { name: '  ', channels: ['ia'] }, context)).toEqual({
      ok: false,
      error: 'grupo-sem-nome',
    })
  })

  it('recusa grupo sem nenhum canal conhecido', () => {
    expect(addCustomGroup([], { name: 'X', channels: ['xyz'] }, context)).toEqual({
      ok: false,
      error: 'grupo-sem-canais',
    })
  })

  it('recusa nome de grupo da planilha ou de outro personalizado', () => {
    expect(addCustomGroup([], { name: 'pago', channels: ['ia'] }, context)).toEqual({
      ok: false,
      error: 'grupo-repetido',
    })
    expect(
      addCustomGroup(
        [{ name: 'Mix', channels: ['ia'] }],
        { name: 'MIX', channels: ['site'] },
        context,
      ),
    ).toEqual({ ok: false, error: 'grupo-repetido' })
  })

  it('recusa acima do limite', () => {
    const full = Array.from({ length: MAX_CUSTOM_GROUPS }, (_, i) => ({
      name: `G${i}`,
      channels: ['ia'],
    }))

    expect(addCustomGroup(full, { name: 'Mais um', channels: ['ia'] }, context)).toEqual({
      ok: false,
      error: 'limite-de-grupos',
    })
  })
})

describe('groupCreationQuery', () => {
  const context = { knownChannels: known, takenNames: ['Orgânico', 'Pago'] }

  it('repassa o estado, grava o grupo novo e já o seleciona', () => {
    const query = groupCreationQuery(
      [
        ['periodo', 'mes-anterior'],
        ['metrica', 'mqls'],
        ['grupos', 'Antigo~site'],
        ['novo_nome', 'Mix'],
        ['novo_canal', 'ia'],
        ['novo_canal', 'blog'],
      ],
      context,
    )

    expect(query).toEqual({
      periodo: 'mes-anterior',
      metrica: 'mqls',
      grupos: 'Antigo~site|Mix~blog,ia',
      grupo: 'Mix',
    })
  })

  it('recusada, mantém os grupos e diz o motivo em aviso', () => {
    const query = groupCreationQuery(
      [
        ['periodo', 'mes-anterior'],
        ['grupos', 'Antigo~site'],
        ['novo_nome', 'Sem canais'],
      ],
      context,
    )

    expect(query).toEqual({
      periodo: 'mes-anterior',
      grupos: 'Antigo~site',
      aviso: 'grupo-sem-canais',
    })
  })

  it('descarta canal em foco, grupo e aviso antigos que vieram na URL', () => {
    const query = groupCreationQuery(
      [
        ['canal', 'site'],
        ['grupo', 'Pago'],
        ['aviso', 'grupo-repetido'],
        ['novo_nome', 'Novo'],
        ['novo_canal', 'site'],
      ],
      context,
    )

    expect(query).toEqual({ grupos: 'Novo~site', grupo: 'Novo' })
  })
})

describe('removeCustomGroup', () => {
  it('remove pelo nome, sem diferenciar caixa, e mantém os outros', () => {
    const groups = [
      { name: 'Mix', channels: ['ia'] },
      { name: 'Outro', channels: ['site'] },
    ]

    expect(removeCustomGroup(groups, 'mix')).toEqual([{ name: 'Outro', channels: ['site'] }])
  })
})

describe('restrictSections', () => {
  it('mantém só os canais do conjunto e descarta seção vazia', () => {
    const sections = restrictSections(groupSections(catalog), new Set(['blog', 'ia']))

    expect(sections.map((s) => [s.label, s.channels.map((c) => c.channel)])).toEqual([
      ['Orgânico', ['blog']],
      [null, ['ia']],
    ])
  })
})
