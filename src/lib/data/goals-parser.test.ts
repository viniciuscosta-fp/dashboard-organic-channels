import { describe, expect, it } from 'vitest'

import { FunnelDataError } from './funnel-repository'
import { parseGoalRows } from './goals-parser'

const header = ['month', 'channel', 'metric', 'target']

describe('parseGoalRows', () => {
  it('converte uma linha em meta', () => {
    expect(parseGoalRows([header, ['2026-08', 'organic_site', 'customers', 24]])).toEqual([
      { month: '2026-08', channel: 'organic_site', metric: 'customers', target: 24 },
    ])
  })

  it('aceita meta de receita com centavos', () => {
    const [parsed] = parseGoalRows([header, ['2026-08', 'brand', 'revenue', 56000.5]])

    expect(parsed.metric).toBe('revenue')
    expect(parsed.target).toBe(56000.5)
  })

  it('mapeia colunas por nome, não por posição', () => {
    const reordered = ['target', 'metric', 'month', 'channel']
    const [parsed] = parseGoalRows([reordered, [24, 'mqls', '2026-08', 'compare']])

    expect(parsed).toEqual({
      month: '2026-08',
      channel: 'compare',
      metric: 'mqls',
      target: 24,
    })
  })

  it('aceita cabeçalho com espaços e maiúsculas', () => {
    const messy = [' Month ', 'CHANNEL', 'Metric', ' Target']

    expect(parseGoalRows([messy, ['2026-08', 'brand', 'customers', 5]])).toHaveLength(1)
  })

  it('normaliza a caixa da métrica', () => {
    const [parsed] = parseGoalRows([header, ['2026-08', 'brand', 'Customers', 5]])

    expect(parsed.metric).toBe('customers')
  })

  it('ignora linhas em branco no fim do intervalo', () => {
    const rows = [
      header,
      ['2026-08', 'brand', 'customers', 5],
      ['', '', '', ''],
      [null, '', '  ', ''],
    ]

    expect(parseGoalRows(rows)).toHaveLength(1)
  })

  it('rejeita cabeçalho sem colunas obrigatórias', () => {
    expect(() => parseGoalRows([['month', 'channel']])).toThrowError(/metric, target/)
    expect(() => parseGoalRows([['month', 'channel']])).toThrowError(/aba de metas/)
  })

  it('rejeita aba vazia', () => {
    expect(() => parseGoalRows([])).toThrowError(/vazia/)
  })

  it('rejeita métrica desconhecida apontando a linha', () => {
    const rows = [header, ['2026-08', 'brand', 'leads', 5]]

    expect(() => parseGoalRows(rows)).toThrowError(/Linha 2/)
    expect(() => parseGoalRows(rows)).toThrowError(FunnelDataError)
  })

  it('rejeita mês fora do formato ISO', () => {
    expect(() => parseGoalRows([header, ['08/2026', 'brand', 'customers', 5]])).toThrowError(
      /AAAA-MM/,
    )
  })

  it('rejeita mês inexistente', () => {
    expect(() => parseGoalRows([header, ['2026-13', 'brand', 'customers', 5]])).toThrowError(
      /AAAA-MM/,
    )
  })

  it('rejeita meta negativa', () => {
    expect(() => parseGoalRows([header, ['2026-08', 'brand', 'customers', -1]])).toThrowError(
      /não pode ser negativo/,
    )
  })

  it('aceita meta zero', () => {
    expect(parseGoalRows([header, ['2026-08', 'brand', 'customers', 0]])[0].target).toBe(0)
  })
})
