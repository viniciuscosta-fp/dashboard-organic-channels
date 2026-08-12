import { describe, expect, it } from 'vitest'

import { FunnelDataError } from './funnel-repository'
import { parseRows } from './sheets-parser'

const header = ['date', 'channel', 'mqls', 'opportunities', 'customers']

describe('parseRows', () => {
  it('converte células de texto em números', () => {
    const result = parseRows([header, ['2026-01-01', 'organic-search', '120', '30', '7']])

    expect(result).toEqual([
      {
        date: '2026-01-01',
        channel: 'organic-search',
        mqls: 120,
        opportunities: 30,
        customers: 7,
      },
    ])
  })

  it('mapeia colunas por nome, não por posição', () => {
    const reordered = ['customers', 'mqls', 'date', 'opportunities', 'channel']
    const result = parseRows([reordered, ['7', '120', '2026-01-01', '30', 'organic-search']])

    expect(result[0]).toEqual({
      date: '2026-01-01',
      channel: 'organic-search',
      mqls: 120,
      opportunities: 30,
      customers: 7,
    })
  })

  it('aceita cabeçalho com espaços e maiúsculas', () => {
    const messy = [' Date ', 'Channel', 'MQLs', 'Opportunities', ' CUSTOMERS']
    const result = parseRows([messy, ['2026-01-01', 'direct', '10', '2', '1']])

    expect(result).toHaveLength(1)
  })

  it('ignora linhas em branco no fim do intervalo', () => {
    const result = parseRows([
      header,
      ['2026-01-01', 'direct', '10', '2', '1'],
      ['', '', '', '', ''],
      ['   ', '', '', '', ''],
    ])

    expect(result).toHaveLength(1)
  })

  it('rejeita cabeçalho sem colunas obrigatórias', () => {
    expect(() => parseRows([['date', 'channel', 'mqls']])).toThrowError(FunnelDataError)
    expect(() => parseRows([['date', 'channel', 'mqls']])).toThrowError(/opportunities, customers/)
  })

  it('rejeita planilha totalmente vazia', () => {
    expect(() => parseRows([])).toThrowError(/vazia/)
  })

  it('aponta o número da linha ao encontrar dado inválido', () => {
    const rows = [
      header,
      ['2026-01-01', 'direct', '10', '2', '1'],
      ['01/02/2026', 'direct', '10', '2', '1'],
    ]

    // Linha 3 da planilha: cabeçalho na 1, primeira linha de dados na 2.
    expect(() => parseRows(rows)).toThrowError(/Linha 3/)
  })

  it('rejeita contagem negativa', () => {
    expect(() => parseRows([header, ['2026-01-01', 'direct', '-5', '2', '1']])).toThrowError(
      /negativa/,
    )
  })

  it('rejeita contagem fracionada', () => {
    expect(() => parseRows([header, ['2026-01-01', 'direct', '10.5', '2', '1']])).toThrowError(
      /inteira/,
    )
  })

  it('rejeita canal vazio', () => {
    expect(() => parseRows([header, ['2026-01-01', '', '10', '2', '1']])).toThrowError(
      FunnelDataError,
    )
  })
})
