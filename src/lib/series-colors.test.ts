import { describe, expect, it } from 'vitest'

import { resolveChannels } from './data/channel-catalog'
import type { ChannelInfo } from './data/types'
import { channelColors, colorOf, NEUTRAL_SERIES_COLOR, SERIES_COLORS } from './series-colors'

function channels(count: number, groupOf: (index: number) => string | undefined): ChannelInfo[] {
  return Array.from({ length: count }, (_, index) => {
    const group = groupOf(index)
    return {
      channel: `canal_${index + 1}`,
      label: `Canal ${index + 1}`,
      order: index + 1,
      ...(group ? { group } : {}),
    }
  })
}

describe('channelColors', () => {
  it('sem grupos, dá a cada canal o próprio slot, na ordem do cadastro', () => {
    const colors = channelColors(
      resolveChannels(
        channels(3, () => undefined),
        [],
      ),
    )

    expect(Object.values(colors)).toEqual(SERIES_COLORS.slice(0, 3))
  })

  it('dá a mesma cor aos canais de um grupo e cores diferentes a grupos diferentes', () => {
    const colors = channelColors(
      resolveChannels(
        channels(15, (index) => ['Orgânico', 'Pago', 'Social'][index % 3]),
        [],
      ),
    )

    const byGroup = [0, 1, 2].map(
      (group) =>
        new Set(
          Object.entries(colors)
            .filter(([channel]) => (Number(channel.split('_')[1]) - 1) % 3 === group)
            .map(([, color]) => color),
        ),
    )

    expect(byGroup.every((set) => set.size === 1)).toBe(true)
    expect(new Set(byGroup.map((set) => [...set][0])).size).toBe(3)
  })

  it('com 15 canais em até cinco grupos, nenhum canal fica sem cor', () => {
    const colors = channelColors(
      resolveChannels(
        channels(15, (index) => `Grupo ${Math.floor(index / 3)}`),
        [],
      ),
    )

    expect(Object.keys(colors)).toHaveLength(15)
    expect(Object.values(colors)).not.toContain(NEUTRAL_SERIES_COLOR)
  })

  it('nunca recicla slot: do sexto grupo em diante, a cor é neutra', () => {
    const colors = channelColors(
      resolveChannels(
        channels(7, () => undefined),
        [],
      ),
    )

    expect(Object.values(colors).slice(0, 5)).toEqual([...SERIES_COLORS])
    expect(colors.canal_6).toBe(NEUTRAL_SERIES_COLOR)
    expect(colors.canal_7).toBe(NEUTRAL_SERIES_COLOR)
  })

  it('não repinta canal quando outro é filtrado do dado', () => {
    const registered = channels(4, (index) => (index < 2 ? 'Orgânico' : 'Pago'))

    const antes = channelColors(resolveChannels(registered, ['canal_1', 'canal_3']))
    const depois = channelColors(resolveChannels(registered, ['canal_3']))

    expect(depois.canal_3).toBe(antes.canal_3)
  })
})

describe('colorOf', () => {
  it('cai na cor neutra para canal fora do mapa', () => {
    expect(colorOf({ brand: 'var(--series-1)' }, 'inexistente')).toBe(NEUTRAL_SERIES_COLOR)
  })
})
