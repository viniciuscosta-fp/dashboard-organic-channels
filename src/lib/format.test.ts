import { describe, expect, it } from 'vitest'

import {
  formatCompactMetric,
  formatCount,
  formatCurrency,
  formatMetricValue,
  formatMonth,
  formatOptionalRatio,
  formatPoints,
  formatRate,
  formatSignedCount,
  formatSignedMetric,
} from './format'

/**
 * As asserções comparam sem os separadores para não depender do caractere
 * exato que o Node usa em pt-BR, que já variou entre versões do ICU.
 */
function semEspacos(value: string): string {
  return value.replace(/\s| | /g, '')
}

describe('formatCurrency', () => {
  it('formata em reais, sem centavos', () => {
    expect(semEspacos(formatCurrency(188450.75))).toBe('R$188.451')
  })

  it('formata zero', () => {
    expect(semEspacos(formatCurrency(0))).toBe('R$0')
  })

  it('formata valor pequeno', () => {
    expect(semEspacos(formatCurrency(12))).toBe('R$12')
  })
})

describe('formatMetricValue', () => {
  it('usa reais para receita e contagem para as demais', () => {
    expect(semEspacos(formatMetricValue('revenue', 2500))).toBe('R$2.500')
    expect(formatMetricValue('customers', 24)).toBe('24')
    expect(formatMetricValue('mqls', 1825)).toBe('1.825')
  })
})

describe('formatSignedMetric', () => {
  it('mostra o sinal na unidade certa', () => {
    expect(semEspacos(formatSignedMetric('revenue', 1200))).toBe('+R$1.200')
    expect(semEspacos(formatSignedMetric('revenue', -1200))).toBe('−R$1.200')
    expect(formatSignedMetric('customers', 4)).toBe('+4')
    expect(formatSignedMetric('customers', -4)).toBe('−4')
  })

  it('não põe sinal em zero', () => {
    expect(semEspacos(formatSignedMetric('revenue', 0))).toBe('R$0')
    expect(formatSignedCount(0)).toBe('0')
  })
})

describe('formatCompactMetric', () => {
  it('abrevia receita a partir de mil', () => {
    expect(semEspacos(formatCompactMetric('revenue', 188451))).toBe('188mil')
  })

  it('não abrevia valor abaixo de mil', () => {
    expect(semEspacos(formatCompactMetric('revenue', 840))).toBe('R$840')
  })

  it('não abrevia contagem', () => {
    expect(formatCompactMetric('mqls', 1825)).toBe('1.825')
  })
})

describe('formatRate e formatCount', () => {
  it('formata razão como percentual', () => {
    expect(formatRate(1, 4)).toBe('25,0%')
  })

  it('devolve travessão quando o divisor é zero', () => {
    expect(formatRate(3, 0)).toBe('—')
  })

  it('formata contagem com separador de milhar', () => {
    expect(formatCount(1825)).toBe('1.825')
  })
})

describe('formatOptionalRatio', () => {
  it('devolve travessão quando não há razão', () => {
    expect(formatOptionalRatio(null)).toBe('—')
  })

  it('formata razão zero como percentual, não como travessão', () => {
    expect(formatOptionalRatio(0)).toBe('0,0%')
  })
})

describe('formatPoints', () => {
  it('mostra o sinal e a unidade em pontos percentuais', () => {
    expect(semEspacos(formatPoints(0.024))).toBe('+2,4p.p.')
    expect(semEspacos(formatPoints(-0.024))).toBe('−2,4p.p.')
  })

  it('não põe sinal em zero', () => {
    expect(semEspacos(formatPoints(0))).toBe('0p.p.')
  })

  it('usa o sinal de menos, não o hífen', () => {
    expect(formatPoints(-0.024)).toContain('−')
    expect(formatPoints(-0.024)).not.toContain('-')
  })

  it('arredonda para uma casa antes de decidir o sinal', () => {
    expect(semEspacos(formatPoints(0.0002))).toBe('0p.p.')
  })
})

describe('formatMonth', () => {
  it('encurta o mês, sem o "de" do formato nativo', () => {
    expect(formatMonth('2026-08-01')).toBe('ago/26')
  })

  it('lê a data em UTC, para o dia 1 não virar o mês anterior', () => {
    expect(formatMonth('2026-01-01')).toBe('jan/26')
  })
})
