import { describe, expect, it } from 'vitest'

import { FunnelDataError } from './funnel-repository'
import { parseRows } from './sheets-parser'

const header = ['date', 'channel', 'revenue', 'mqls', 'opportunities', 'customers']

describe('parseRows', () => {
  it('converte uma linha completa', () => {
    expect(parseRows([header, ['2026-08-12', 'organic_site', 18450.75, 16, 4, 1]])).toEqual([
      {
        date: '2026-08-12',
        channel: 'organic_site',
        revenue: 18450.75,
        mqls: 16,
        opportunities: 4,
        customers: 1,
      },
    ])
  })

  it('aceita células como texto, não só como número', () => {
    const [parsed] = parseRows([header, ['2026-08-12', 'brand', '3200.5', '4', '2', '1']])

    expect(parsed.revenue).toBe(3200.5)
    expect(parsed.mqls).toBe(4)
  })

  it('mapeia colunas por nome, não por posição', () => {
    const reordered = ['customers', 'mqls', 'date', 'revenue', 'opportunities', 'channel']
    const [parsed] = parseRows([reordered, [1, 16, '2026-08-12', 18450.75, 4, 'organic_site']])

    expect(parsed).toEqual({
      date: '2026-08-12',
      channel: 'organic_site',
      revenue: 18450.75,
      mqls: 16,
      opportunities: 4,
      customers: 1,
    })
  })

  it('aceita cabeçalho com espaços e maiúsculas', () => {
    const messy = [' Date ', 'CHANNEL', 'Revenue', 'MQLs', 'Opportunities', ' CUSTOMERS']

    expect(parseRows([messy, ['2026-08-12', 'compare', 0, 10, 2, 0]])).toHaveLength(1)
  })

  it('aceita dia sem receita', () => {
    const [parsed] = parseRows([header, ['2026-08-12', 'compare', 0, 10, 2, 0]])

    expect(parsed.revenue).toBe(0)
    expect(parsed.customers).toBe(0)
  })

  it('ignora linhas em branco no fim do intervalo', () => {
    const rows = [
      header,
      ['2026-08-12', 'brand', 3200, 4, 2, 1],
      ['', '', '', '', '', ''],
      [null, undefined, '', '  ', '', ''],
    ]

    expect(parseRows(rows)).toHaveLength(1)
  })

  it('rejeita cabeçalho sem colunas obrigatórias', () => {
    expect(() => parseRows([['date', 'channel', 'mqls']])).toThrowError(
      /revenue, opportunities, customers/,
    )
  })

  it('rejeita aba vazia', () => {
    expect(() => parseRows([])).toThrowError(/vazia/)
  })

  it('aponta o número da linha ao encontrar dado inválido', () => {
    const rows = [
      header,
      ['2026-08-12', 'brand', 3200, 4, 2, 1],
      ['12/08/2026', 'brand', 3200, 4, 2, 1],
    ]

    // Linha 3 da planilha: cabeçalho na 1, primeira linha de dados na 2.
    expect(() => parseRows(rows)).toThrowError(/Linha 3/)
  })

  it('rejeita contagem negativa e fracionada', () => {
    expect(() => parseRows([header, ['2026-08-12', 'brand', 0, -5, 2, 1]])).toThrowError(/negativa/)
    expect(() => parseRows([header, ['2026-08-12', 'brand', 0, 10.5, 2, 1]])).toThrowError(
      /inteira/,
    )
  })

  it('rejeita receita negativa', () => {
    expect(() => parseRows([header, ['2026-08-12', 'brand', -1, 4, 2, 1]])).toThrowError(
      /não pode ser negativo/,
    )
  })

  /**
   * A API do Sheets, sem `valueRenderOption=UNFORMATTED_VALUE`, devolveria a
   * célula formatada. Este teste documenta que texto assim é recusado em vez de
   * virar um número mil vezes menor em silêncio.
   */
  it('recusa valor formatado como moeda em vez de interpretá-lo errado', () => {
    expect(() => parseRows([header, ['2026-08-12', 'brand', 'R$ 3.200,50', 4, 2, 1]])).toThrowError(
      /monetário inválido/,
    )
  })

  it('rejeita canal vazio', () => {
    expect(() => parseRows([header, ['2026-08-12', '', 0, 10, 2, 1]])).toThrowError(FunnelDataError)
  })

  it('rejeita o mesmo dia e canal repetidos, apontando as duas linhas', () => {
    const rows = [
      header,
      ['2026-08-12', 'brand', 3200, 4, 2, 1],
      ['2026-08-12', 'compare', 2600, 6, 2, 1],
      ['2026-08-12', 'brand', 3200, 4, 2, 1],
    ]

    expect(() => parseRows(rows)).toThrowError(/Linhas 2 e 4/)
    expect(() => parseRows(rows)).toThrowError(/brand/)
  })

  it('aceita o mesmo dia em canais diferentes', () => {
    const rows = [
      header,
      ['2026-08-12', 'brand', 3200, 4, 2, 1],
      ['2026-08-12', 'compare', 2600, 6, 2, 1],
    ]

    expect(parseRows(rows)).toHaveLength(2)
  })

  it('aceita o mesmo canal em dias diferentes', () => {
    const rows = [
      header,
      ['2026-08-12', 'brand', 3200, 4, 2, 1],
      ['2026-08-13', 'brand', 0, 5, 1, 0],
    ]

    expect(parseRows(rows)).toHaveLength(2)
  })
})
