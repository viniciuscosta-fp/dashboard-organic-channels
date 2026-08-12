import { describe, expect, it } from 'vitest'

import { labelOf, resolveChannels } from './channel-catalog'
import type { ChannelInfo } from './types'

const registered: ChannelInfo[] = [
  { channel: 'organic_site', label: 'Organic Search Site', order: 1 },
  { channel: 'brand', label: 'Organic Search (Brand)', order: 2 },
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

    expect(compare).toEqual({ channel: 'compare', label: 'compare', registered: false })
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

    expect(channels).toEqual([{ channel: 'compare', label: 'compare', registered: false }])
    expect(unregistered).toEqual(['compare'])
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
