import { describe, expect, it } from 'vitest'

import {
  addDays,
  businessDaysByMonth,
  businessDaysInMonth,
  countBusinessDays,
  isBusinessDay,
  isIsoDate,
  listBusinessDays,
  monthBounds,
  monthOf,
} from './business-days'

describe('isIsoDate', () => {
  it('aceita data válida', () => {
    expect(isIsoDate('2026-08-12')).toBe(true)
  })

  it('rejeita formato errado', () => {
    expect(isIsoDate('12/08/2026')).toBe(false)
    expect(isIsoDate('2026-8-12')).toBe(false)
  })

  it('rejeita data que existe no formato mas não no calendário', () => {
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('2026-13-01')).toBe(false)
  })

  it('aceita 29 de fevereiro em ano bissexto e rejeita fora dele', () => {
    expect(isIsoDate('2028-02-29')).toBe(true)
    expect(isIsoDate('2026-02-29')).toBe(false)
  })
})

describe('isBusinessDay', () => {
  it('reconhece segunda a sexta', () => {
    // 2026-08-10 é uma segunda-feira.
    expect(
      ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14'].every(isBusinessDay),
    ).toBe(true)
  })

  it('rejeita sábado e domingo', () => {
    expect(isBusinessDay('2026-08-15')).toBe(false)
    expect(isBusinessDay('2026-08-16')).toBe(false)
  })
})

describe('addDays e monthOf', () => {
  it('atravessa a virada de mês', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
  })

  it('atravessa a virada de ano', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('anda para trás', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('extrai o mês', () => {
    expect(monthOf('2026-08-12')).toBe('2026-08')
  })
})

describe('monthBounds', () => {
  it('resolve mês de 31 dias', () => {
    expect(monthBounds('2026-08')).toEqual({ from: '2026-08-01', to: '2026-08-31' })
  })

  it('resolve mês de 30 dias', () => {
    expect(monthBounds('2026-09')).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })

  it('resolve fevereiro comum e bissexto', () => {
    expect(monthBounds('2026-02').to).toBe('2026-02-28')
    expect(monthBounds('2028-02').to).toBe('2028-02-29')
  })
})

describe('countBusinessDays', () => {
  it('conta uma semana cheia como 5', () => {
    // Segunda a domingo.
    expect(countBusinessDays('2026-08-10', '2026-08-16')).toBe(5)
  })

  it('conta um único dia útil', () => {
    expect(countBusinessDays('2026-08-12', '2026-08-12')).toBe(1)
  })

  it('conta zero num intervalo só de fim de semana', () => {
    expect(countBusinessDays('2026-08-15', '2026-08-16')).toBe(0)
  })

  it('devolve zero quando o intervalo está invertido', () => {
    expect(countBusinessDays('2026-08-20', '2026-08-10')).toBe(0)
  })

  it('conta agosto de 2026 inteiro', () => {
    // Agosto de 2026 tem 21 dias úteis.
    expect(countBusinessDays('2026-08-01', '2026-08-31')).toBe(21)
  })

  it('atravessa a virada de ano', () => {
    // 30 e 31 de dezembro de 2026 são quarta e quinta; 1 de janeiro é sexta.
    expect(countBusinessDays('2026-12-30', '2027-01-01')).toBe(3)
  })
})

describe('listBusinessDays', () => {
  it('devolve as datas em ordem crescente, sem fim de semana', () => {
    expect(listBusinessDays('2026-08-13', '2026-08-17')).toEqual([
      '2026-08-13',
      '2026-08-14',
      '2026-08-17',
    ])
  })
})

describe('businessDaysInMonth', () => {
  it('conta os dias úteis de meses conhecidos', () => {
    expect(businessDaysInMonth('2026-08')).toBe(21)
    expect(businessDaysInMonth('2026-02')).toBe(20)
  })
})

describe('businessDaysByMonth', () => {
  it('agrupa um intervalo contido num único mês', () => {
    expect([...businessDaysByMonth('2026-08-10', '2026-08-14')]).toEqual([['2026-08', 5]])
  })

  it('reparte um intervalo que atravessa dois meses', () => {
    const byMonth = businessDaysByMonth('2026-08-27', '2026-09-03')

    // Ago: 27, 28, 31. Set: 1, 2, 3.
    expect(byMonth.get('2026-08')).toBe(3)
    expect(byMonth.get('2026-09')).toBe(3)
  })

  it('reparte um intervalo que atravessa três meses', () => {
    const byMonth = businessDaysByMonth('2026-07-30', '2026-09-02')

    expect([...byMonth.keys()]).toEqual(['2026-07', '2026-08', '2026-09'])
    expect(byMonth.get('2026-08')).toBe(businessDaysInMonth('2026-08'))
  })

  it('não cria entrada para mês sem dia útil selecionado', () => {
    // Sábado e domingo da virada de agosto para setembro de 2025.
    expect([...businessDaysByMonth('2025-08-30', '2025-08-31')]).toEqual([])
  })

  it('a soma por mês bate com a contagem total', () => {
    const from = '2026-06-15'
    const to = '2026-09-10'
    const soma = [...businessDaysByMonth(from, to).values()].reduce((a, b) => a + b, 0)

    expect(soma).toBe(countBusinessDays(from, to))
  })
})
