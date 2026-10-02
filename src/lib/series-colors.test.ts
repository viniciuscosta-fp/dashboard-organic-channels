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
  it('dá a cada canal o próprio slot, na ordem canônica', () => {
    const colors = channelColors(
      resolveChannels(
        channels(3, () => undefined),
        [],
      ),
    )

    expect(colors).toEqual({
      canal_1: SERIES_COLORS[0],
      canal_2: SERIES_COLORS[1],
      canal_3: SERIES_COLORS[2],
    })
  })

  it('não repete cor entre canais do mesmo grupo', () => {
    const colors = channelColors(
      resolveChannels(
        channels(3, () => 'Pago'),
        [],
      ),
    )

    expect(new Set(Object.values(colors)).size).toBe(3)
  })

  it('segue a ordem canônica, que junta os canais de um grupo', () => {
    // canal_2 é de outro grupo e vai para depois dos dois canais de "A".
    const registered = channels(3, (index) => (index === 1 ? 'B' : 'A'))
    const colors = channelColors(resolveChannels(registered, []))

    expect(colors.canal_3).toBe(SERIES_COLORS[1])
    expect(colors.canal_2).toBe(SERIES_COLORS[2])
  })

  it('nunca recicla slot: do sexto canal em diante, a cor é neutra', () => {
    const colors = channelColors(
      resolveChannels(
        channels(15, () => undefined),
        [],
      ),
    )

    expect(Object.values(colors).slice(0, 5)).toEqual([...SERIES_COLORS])
    expect(
      Object.values(colors)
        .slice(5)
        .every((color) => color === NEUTRAL_SERIES_COLOR),
    ).toBe(true)
  })

  it('não repinta canal quando outro some do dado', () => {
    const registered = channels(4, () => undefined)

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
