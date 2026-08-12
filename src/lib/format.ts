const integerFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const monthFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
  timeZone: 'UTC',
})

export function formatCount(value: number): string {
  return integerFormatter.format(value)
}

/** Formata uma razão já calculada como percentual. */
export function formatRatio(ratio: number): string {
  return percentFormatter.format(ratio)
}

/**
 * Formata uma divisão como percentual. Divisor zero vira travessão em vez de
 * `NaN%` — mês sem MQL é um estado válido, não um erro.
 */
export function formatRate(numerator: number, denominator: number): string {
  if (denominator === 0) return '—'
  return formatRatio(numerator / denominator)
}

/**
 * `2026-08-01` → `ago/26`.
 *
 * Monta o rótulo à mão porque o formato nativo de mês e ano em pt-BR rende
 * `ago. de 26`, longo demais para tick de eixo.
 *
 * Interpreta a data em UTC de propósito: sem isso, um navegador em UTC-3 lê
 * `2026-08-01` como 31 de julho e o rótulo do mês sai errado.
 */
export function formatMonth(isoDate: string): string {
  const month = monthFormatter.format(new Date(`${isoDate}T00:00:00Z`)).replace('.', '')
  return `${month}/${isoDate.slice(2, 4)}`
}
