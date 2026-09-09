import { describe, expect, it } from 'vitest'

import { ratioDelta, relativeChange, safeRatio } from './ratio'

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

describe('relativeChange', () => {
  it('mede crescimento e queda em fração', () => {
    expect(relativeChange(30, 20)).toBeCloseTo(0.5)
    expect(relativeChange(10, 20)).toBeCloseTo(-0.5)
  })

  it('devolve null quando a base anterior é zero, e não infinito', () => {
    expect(relativeChange(8, 0)).toBeNull()
    expect(Number.isFinite(relativeChange(8, 0) ?? 0)).toBe(true)
  })

  it('não trata dois zeros como variação zero', () => {
    expect(relativeChange(0, 0)).toBeNull()
  })

  it('mede desaparecimento como queda de cem por cento', () => {
    expect(relativeChange(0, 20)).toBeCloseTo(-1)
  })
})
