import { describe, expect, it } from 'vitest'

import { FunnelDataError } from './funnel-repository'
import { parseGoalRows } from './goals-parser'

const header = ['month', 'channel', 'stage', 'target']

describe('parseGoalRows', () => {
  it('converte células de texto em metas', () => {
    expect(parseGoalRows([header, ['2026-08', 'organic-search', 'customers', '24']])).toEqual([
      { month: '2026-08', channel: 'organic-search', stage: 'customers', target: 24 },
    ])
  })

  it('mapeia colunas por nome, não por posição', () => {
    const reordered = ['target', 'stage', 'month', 'channel']
    const [parsed] = parseGoalRows([reordered, ['24', 'mqls', '2026-08', 'direct']])

    expect(parsed).toEqual({
      month: '2026-08',
      channel: 'direct',
      stage: 'mqls',
      target: 24,
    })
  })

  it('aceita cabeçalho com espaços e maiúsculas', () => {
    const messy = [' Month ', 'CHANNEL', 'Stage', ' Target']

    expect(parseGoalRows([messy, ['2026-08', 'direct', 'customers', '5']])).toHaveLength(1)
  })

  it('normaliza a caixa da etapa', () => {
    const [parsed] = parseGoalRows([header, ['2026-08', 'direct', 'Customers', '5']])

    expect(parsed.stage).toBe('customers')
  })

  it('ignora linhas em branco no fim do intervalo', () => {
    const rows = [
      header,
      ['2026-08', 'direct', 'customers', '5'],
      ['', '', '', ''],
      ['  ', '', '', ''],
    ]

    expect(parseGoalRows(rows)).toHaveLength(1)
  })

  it('rejeita cabeçalho sem colunas obrigatórias', () => {
    expect(() => parseGoalRows([['month', 'channel']])).toThrowError(/stage, target/)
    expect(() => parseGoalRows([['month', 'channel']])).toThrowError(/aba de metas/)
  })

  it('rejeita aba vazia', () => {
    expect(() => parseGoalRows([])).toThrowError(/vazia/)
  })

  it('rejeita etapa desconhecida apontando a linha', () => {
    const rows = [header, ['2026-08', 'direct', 'leads', '5']]

    expect(() => parseGoalRows(rows)).toThrowError(/Linha 2/)
    expect(() => parseGoalRows(rows)).toThrowError(FunnelDataError)
  })

  it('rejeita mês fora do formato ISO', () => {
    expect(() => parseGoalRows([header, ['08/2026', 'direct', 'customers', '5']])).toThrowError(
      /AAAA-MM/,
    )
  })

  it('rejeita mês inexistente', () => {
    expect(() => parseGoalRows([header, ['2026-13', 'direct', 'customers', '5']])).toThrowError(
      /AAAA-MM/,
    )
  })

  it('rejeita meta negativa e fracionada', () => {
    expect(() => parseGoalRows([header, ['2026-08', 'direct', 'customers', '-1']])).toThrowError(
      /negativa/,
    )
    expect(() => parseGoalRows([header, ['2026-08', 'direct', 'customers', '2.5']])).toThrowError(
      /inteira/,
    )
  })

  it('aceita meta zero', () => {
    expect(parseGoalRows([header, ['2026-08', 'direct', 'customers', '0']])[0].target).toBe(0)
  })
})
