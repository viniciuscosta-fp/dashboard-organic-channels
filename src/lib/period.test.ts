import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PRESET,
  isValidRange,
  MAX_PERIOD_DAYS,
  parsePeriod,
  periodSearchParams,
  resolvePreset,
} from './period'

// Quarta-feira, 12 de agosto de 2026.
const HOJE = '2026-08-12'

describe('resolvePreset', () => {
  it('mês atual vai até o fim do mês, não até hoje', () => {
    expect(resolvePreset('mes-atual', HOJE)).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    })
  })

  it('mês anterior cobre o mês fechado', () => {
    expect(resolvePreset('mes-anterior', HOJE)).toEqual({
      from: '2026-07-01',
      to: '2026-07-31',
    })
  })

  it('mês anterior atravessa a virada de ano', () => {
    expect(resolvePreset('mes-anterior', '2026-01-15')).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    })
  })

  it('janela móvel de 30 dias termina hoje e cobre 30 dias', () => {
    expect(resolvePreset('ultimos-30-dias', HOJE)).toEqual({
      from: '2026-07-14',
      to: HOJE,
    })
  })

  it('janela móvel de 90 dias termina hoje', () => {
    expect(resolvePreset('ultimos-90-dias', HOJE)).toEqual({
      from: '2026-05-15',
      to: HOJE,
    })
  })

  it('trimestre atual cobre os três meses do trimestre', () => {
    expect(resolvePreset('trimestre-atual', HOJE)).toEqual({
      from: '2026-07-01',
      to: '2026-09-30',
    })
  })

  it('trimestre atual resolve a primeira e a última posição do ano', () => {
    expect(resolvePreset('trimestre-atual', '2026-01-05')).toEqual({
      from: '2026-01-01',
      to: '2026-03-31',
    })
    expect(resolvePreset('trimestre-atual', '2026-12-31')).toEqual({
      from: '2026-10-01',
      to: '2026-12-31',
    })
  })
})

describe('isValidRange', () => {
  it('aceita intervalo bem formado', () => {
    expect(isValidRange({ from: '2026-08-01', to: '2026-08-31' })).toBe(true)
  })

  it('aceita intervalo de um único dia', () => {
    expect(isValidRange({ from: HOJE, to: HOJE })).toBe(true)
  })

  it('rejeita intervalo invertido', () => {
    expect(isValidRange({ from: '2026-08-31', to: '2026-08-01' })).toBe(false)
  })

  it('rejeita data mal formada', () => {
    expect(isValidRange({ from: '12/08/2026', to: '2026-08-31' })).toBe(false)
    expect(isValidRange({ from: '2026-02-30', to: '2026-03-01' })).toBe(false)
  })

  it('rejeita intervalo maior que o teto', () => {
    expect(isValidRange({ from: '2024-01-01', to: '2026-12-31' })).toBe(false)
  })

  it('aceita exatamente o teto', () => {
    const from = '2026-01-01'
    const to = new Date(Date.UTC(2026, 0, MAX_PERIOD_DAYS)).toISOString().slice(0, 10)

    expect(isValidRange({ from, to })).toBe(true)
  })
})

describe('parsePeriod', () => {
  it('usa o preset padrão quando não há parâmetro', () => {
    const { range, presetId } = parsePeriod({}, HOJE)

    expect(presetId).toBe(DEFAULT_PRESET)
    expect(range).toEqual(resolvePreset(DEFAULT_PRESET, HOJE))
  })

  it('resolve um preset informado', () => {
    expect(parsePeriod({ periodo: 'mes-anterior' }, HOJE)).toEqual({
      range: { from: '2026-07-01', to: '2026-07-31' },
      presetId: 'mes-anterior',
    })
  })

  it('aceita intervalo personalizado e não devolve preset', () => {
    expect(parsePeriod({ de: '2026-06-10', ate: '2026-07-05' }, HOJE)).toEqual({
      range: { from: '2026-06-10', to: '2026-07-05' },
      presetId: null,
    })
  })

  it('o intervalo personalizado tem precedência sobre o preset', () => {
    const { presetId, range } = parsePeriod(
      { periodo: 'mes-anterior', de: '2026-06-10', ate: '2026-06-20' },
      HOJE,
    )

    expect(presetId).toBeNull()
    expect(range.from).toBe('2026-06-10')
  })

  it('cai no padrão quando o preset é desconhecido', () => {
    expect(parsePeriod({ periodo: 'semana-passada' }, HOJE).presetId).toBe(DEFAULT_PRESET)
  })

  it('cai no padrão quando o intervalo é inválido, sem lançar', () => {
    expect(parsePeriod({ de: '2026-08-31', ate: '2026-08-01' }, HOJE).presetId).toBe(DEFAULT_PRESET)
    expect(parsePeriod({ de: 'ontem', ate: 'hoje' }, HOJE).presetId).toBe(DEFAULT_PRESET)
  })

  it('cai no padrão quando só uma das pontas foi informada', () => {
    expect(parsePeriod({ de: '2026-08-01' }, HOJE).presetId).toBe(DEFAULT_PRESET)
  })

  it('usa o primeiro valor quando o parâmetro vem repetido', () => {
    expect(parsePeriod({ periodo: ['mes-anterior', 'mes-atual'] }, HOJE).presetId).toBe(
      'mes-anterior',
    )
  })
})

describe('periodSearchParams', () => {
  it('serializa preset', () => {
    expect(periodSearchParams('mes-anterior')).toEqual({ periodo: 'mes-anterior' })
  })

  it('serializa intervalo personalizado', () => {
    expect(periodSearchParams({ from: '2026-06-01', to: '2026-06-30' })).toEqual({
      de: '2026-06-01',
      ate: '2026-06-30',
    })
  })

  it('a ida e volta preserva o intervalo', () => {
    const range = { from: '2026-06-01', to: '2026-06-30' }
    expect(parsePeriod(periodSearchParams(range), HOJE).range).toEqual(range)
  })
})
