import { describe, expect, it } from 'vitest'

import { parseChannelRows } from './channels-parser'
import { FunnelDataError } from './funnel-repository'

const header = ['channel', 'label', 'order']

describe('parseChannelRows', () => {
  it('converte o cadastro em canais', () => {
    expect(parseChannelRows([header, ['organic_site', 'Organic Search Site', 1]])).toEqual([
      { channel: 'organic_site', label: 'Organic Search Site', order: 1 },
    ])
  })

  it('devolve ordenado por order, e não pela ordem das linhas', () => {
    const rows = [
      header,
      ['ai_referrals', 'Referências de IA', 5],
      ['organic_site', 'Organic Search Site', 1],
      ['brand', 'Organic Search (Brand)', 4],
    ]

    expect(parseChannelRows(rows).map((c) => c.channel)).toEqual([
      'organic_site',
      'brand',
      'ai_referrals',
    ])
  })

  it('desempata ordem repetida pela chave, para a tela não ficar instável', () => {
    const rows = [header, ['compare', 'Compare', 2], ['brand', 'Brand', 2]]

    expect(parseChannelRows(rows).map((c) => c.channel)).toEqual(['brand', 'compare'])
  })

  it('mapeia colunas por nome, não por posição', () => {
    const reordered = ['order', 'channel', 'label']
    const [parsed] = parseChannelRows([reordered, [3, 'compare', 'Compare Escolas']])

    expect(parsed).toEqual({ channel: 'compare', label: 'Compare Escolas', order: 3 })
  })

  it('ignora linhas em branco no fim do intervalo', () => {
    const rows = [header, ['brand', 'Brand', 1], ['', '', ''], [null, '  ', '']]

    expect(parseChannelRows(rows)).toHaveLength(1)
  })

  it('rejeita cabeçalho sem colunas obrigatórias', () => {
    expect(() => parseChannelRows([['channel']])).toThrowError(/label, order/)
    expect(() => parseChannelRows([['channel']])).toThrowError(/aba de canais/)
  })

  it('rejeita rótulo vazio, que deixaria o canal sem nome na tela', () => {
    expect(() => parseChannelRows([header, ['brand', '', 1]])).toThrowError(/Linha 2/)
  })

  it('rejeita o mesmo canal cadastrado duas vezes', () => {
    const rows = [header, ['brand', 'Brand', 1], ['compare', 'Compare', 2], ['brand', 'Marca', 3]]

    expect(() => parseChannelRows(rows)).toThrowError(/Linhas 2 e 4/)
    expect(() => parseChannelRows(rows)).toThrowError(FunnelDataError)
  })

  it('rejeita ordem não numérica', () => {
    expect(() => parseChannelRows([header, ['brand', 'Brand', 'primeiro']])).toThrowError(/Linha 2/)
  })

  describe('coluna group', () => {
    const withGroup = ['channel', 'label', 'order', 'group']

    it('lê o grupo quando a coluna existe', () => {
      const [parsed] = parseChannelRows([withGroup, ['brand', 'Brand', 1, 'Orgânico']])

      expect(parsed).toStrictEqual({
        channel: 'brand',
        label: 'Brand',
        order: 1,
        group: 'Orgânico',
      })
    })

    it('aceita a planilha sem a coluna, deixando o canal sem grupo', () => {
      const [parsed] = parseChannelRows([header, ['brand', 'Brand', 1]])

      expect(parsed).toStrictEqual({ channel: 'brand', label: 'Brand', order: 1 })
    })

    it('trata célula de grupo vazia como canal sem grupo, não como erro', () => {
      const rows = [withGroup, ['brand', 'Brand', 1, '   '], ['compare', 'Compare', 2, null]]

      expect(parseChannelRows(rows).map((c) => c.group)).toEqual([undefined, undefined])
    })

    it('mapeia a coluna de grupo por nome, em qualquer posição e caixa', () => {
      const [parsed] = parseChannelRows([
        [' Group ', 'order', 'channel', 'label'],
        ['Pago', 3, 'paid_search', 'Busca paga'],
      ])

      expect(parsed.group).toBe('Pago')
    })

    it('apara espaços nas bordas do grupo', () => {
      const [parsed] = parseChannelRows([withGroup, ['brand', 'Brand', 1, '  Orgânico ']])

      expect(parsed.group).toBe('Orgânico')
    })
  })
})
