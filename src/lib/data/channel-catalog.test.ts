import { describe, expect, it } from 'vitest'

import { groupLabelOf, groupSections, labelOf, resolveChannels } from './channel-catalog'
import type { ChannelInfo } from './types'

const registered: ChannelInfo[] = [
  { channel: 'organic_site', label: 'Organic Search Site', order: 1 },
  { channel: 'brand', label: 'Organic Search (Brand)', order: 2 },
]

const grouped: ChannelInfo[] = [
  { channel: 'organic_site', label: 'Site', order: 1, group: 'Orgânico' },
  { channel: 'paid_search', label: 'Busca paga', order: 2, group: 'Pago' },
  { channel: 'blog', label: 'Blog', order: 3, group: 'Orgânico' },
  { channel: 'newsletter', label: 'Newsletter', order: 4 },
  { channel: 'paid_social', label: 'Social pago', order: 5, group: 'pago ' },
]

describe('resolveChannels', () => {
  it('usa o rótulo e a ordem do cadastro', () => {
    const { channels, unregistered } = resolveChannels(registered, ['brand', 'organic_site'])

    expect(channels.map((c) => c.label)).toEqual(['Organic Search Site', 'Organic Search (Brand)'])
    expect(unregistered).toEqual([])
  })

  it('mantém canal cadastrado sem dado no período', () => {
    const { channels } = resolveChannels(registered, ['organic_site'])

    expect(channels.map((c) => c.channel)).toContain('brand')
  })

  it('mostra canal fora do cadastro com a chave crua e o registra como aviso', () => {
    const { channels, unregistered } = resolveChannels(registered, ['organic_site', 'compare'])

    const compare = channels.find((c) => c.channel === 'compare')

    expect(compare).toEqual({
      channel: 'compare',
      label: 'compare',
      group: { key: 'canal:compare', label: null },
      registered: false,
    })
    expect(unregistered).toEqual(['compare'])
  })

  it('põe os não cadastrados depois dos cadastrados', () => {
    const { channels } = resolveChannels(registered, ['zzz_novo', 'organic_site'])

    expect(channels.at(-1)?.channel).toBe('zzz_novo')
  })

  it('não duplica canal visto várias vezes nos dados', () => {
    const { unregistered } = resolveChannels(registered, ['compare', 'compare', 'compare'])

    expect(unregistered).toEqual(['compare'])
  })

  it('funciona com cadastro vazio', () => {
    const { channels, unregistered } = resolveChannels([], ['compare'])

    expect(channels.map((c) => c.channel)).toEqual(['compare'])
    expect(unregistered).toEqual(['compare'])
  })

  describe('grupos', () => {
    it('sem coluna de grupo, cada canal é um grupo de um só', () => {
      const { groups } = resolveChannels(registered, [])

      expect(groups).toEqual([
        { key: 'canal:organic_site', label: null },
        { key: 'canal:brand', label: null },
      ])
    })

    it('junta os canais do mesmo grupo, na posição do primeiro canal do grupo', () => {
      const { channels } = resolveChannels(grouped, [])

      expect(channels.map((c) => c.channel)).toEqual([
        'organic_site',
        'blog',
        'paid_search',
        'paid_social',
        'newsletter',
      ])
    })

    it('identifica o grupo sem diferenciar caixa nem espaços, com o nome da primeira ocorrência', () => {
      const { channels, groups } = resolveChannels(grouped, [])

      expect(channels.find((c) => c.channel === 'paid_social')?.group).toEqual({
        key: 'grupo:pago',
        label: 'Pago',
      })
      expect(groups.map((g) => g.label)).toEqual(['Orgânico', 'Pago', null])
    })

    it('dá a cada não cadastrado o próprio grupo, depois dos cadastrados', () => {
      const { groups } = resolveChannels(grouped, ['zzz_novo'])

      expect(groups.at(-1)).toEqual({ key: 'canal:zzz_novo', label: null })
    })
  })
})

describe('labelOf', () => {
  it('devolve o rótulo cadastrado', () => {
    const catalog = resolveChannels(registered, [])

    expect(labelOf(catalog, 'brand')).toBe('Organic Search (Brand)')
  })

  it('cai na chave crua para canal desconhecido', () => {
    const catalog = resolveChannels(registered, [])

    expect(labelOf(catalog, 'inexistente')).toBe('inexistente')
  })
})

describe('groupLabelOf', () => {
  it('devolve o nome do grupo, ou null para canal sem grupo e desconhecido', () => {
    const catalog = resolveChannels(grouped, [])

    expect(groupLabelOf(catalog, 'blog')).toBe('Orgânico')
    expect(groupLabelOf(catalog, 'newsletter')).toBeNull()
    expect(groupLabelOf(catalog, 'inexistente')).toBeNull()
  })
})

describe('groupSections', () => {
  it('abre um trecho por grupo, com o nome do grupo', () => {
    const sections = groupSections(resolveChannels(grouped, []))

    expect(sections.map((s) => [s.label, s.channels.map((c) => c.channel)])).toEqual([
      ['Orgânico', ['organic_site', 'blog']],
      ['Pago', ['paid_search', 'paid_social']],
      [null, ['newsletter']],
    ])
  })

  it('junta canais sem grupo vizinhos num trecho só, sem título', () => {
    const sections = groupSections(resolveChannels(registered, ['zzz_novo']))

    expect(sections).toHaveLength(1)
    expect(sections[0].label).toBeNull()
    expect(sections[0].channels.map((c) => c.channel)).toEqual([
      'organic_site',
      'brand',
      'zzz_novo',
    ])
  })

  it('devolve vazio para catálogo vazio', () => {
    expect(groupSections(resolveChannels([], []))).toEqual([])
  })
})
