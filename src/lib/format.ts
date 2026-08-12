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

const longDayFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

export function formatCount(value: number): string {
  return integerFormatter.format(value)
}

/**
 * Contagem com sinal explícito, para gap contra a meta.
 *
 * O `+` é obrigatório: sem ele, "12" e "−12" só se distinguem por um caractere
 * fácil de perder de vista numa tabela.
 */
export function formatSignedCount(value: number): string {
  const rounded = Math.round(value)
  if (rounded === 0) return '0'
  return `${rounded > 0 ? '+' : '−'}${integerFormatter.format(Math.abs(rounded))}`
}

/** `2026-08-12` → `12/08`. */
export function formatDayMonth(isoDate: string): string {
  const [, month, day] = isoDate.split('-')
  return `${day}/${month}`
}

/** `2026-08-12` → `12 de agosto`. */
export function formatLongDay(isoDate: string): string {
  return longDayFormatter.format(new Date(`${isoDate}T00:00:00Z`))
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
