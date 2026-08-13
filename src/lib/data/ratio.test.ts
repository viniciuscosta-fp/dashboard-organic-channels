import { describe, expect, it } from 'vitest'

import { ratioDelta, safeRatio } from './ratio'

describe('safeRatio', () => {
  it('divide quando há denominador', () => {
    expect(safeRatio(3, 12)).toBe(0.25)
  })

  it('devolve null quando o denominador é zero', () => {
    expect(safeRatio(3, 0)).toBeNull()
  })

  it('devolve zero quando o numerador é zero e o denominador não', () => {
    expect(safeRatio(0, 12)).toBe(0)
  })

  it('distingue numerador zero de denominador zero', () => {
    expect(safeRatio(0, 0)).toBeNull()
    expect(safeRatio(0, 1)).toBe(0)
  })
})

describe('ratioDelta', () => {
  it('subtrai em pontos da razão', () => {
    expect(ratioDelta(0.24, 0.3)).toBeCloseTo(-0.06)
  })

  it('devolve null quando o realizado não existe', () => {
    expect(ratioDelta(null, 0.3)).toBeNull()
  })

  it('devolve null quando a referência não existe', () => {
    expect(ratioDelta(0.24, null)).toBeNull()
  })

  it('não confunde diferença zero com ausência', () => {
    expect(ratioDelta(0.3, 0.3)).toBe(0)
  })
})
