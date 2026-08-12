/**
 * Aritmética de dias úteis.
 *
 * "Dia útil" aqui é segunda a sexta. Feriados **não** são descontados — a
 * decisão e seus gatilhos de revisão estão em
 * `docs/decisions/0003-base-de-dias-uteis-e-metodo-de-projecao.md`.
 *
 * Todas as datas são strings ISO `AAAA-MM-DD` e toda conta acontece em UTC.
 * Isso não é detalhe: em UTC-3, `new Date('2026-08-01')` cai em 31 de julho, e
 * o dia inteiro escorregaria para o mês errado no rateio da meta.
 */

/** Mês no formato ISO `AAAA-MM`. */
export type IsoMonth = string

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ISO_MONTH = /^\d{4}-\d{2}$/

/** Teto de segurança para não iterar um intervalo absurdo vindo da URL. */
const MAX_DIAS_INTERVALO = 1200

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false

  // Rejeita data que existe no formato mas não no calendário, como 2026-02-30.
  // O parser de ISO do JavaScript devolve `Invalid Date` nesses casos, e daí
  // `toISOString` lança — por isso a checagem vem antes da conversão.
  const date = parseIsoDate(value)
  if (Number.isNaN(date.getTime())) return false

  return toIsoDate(date) === value
}

export function isIsoMonth(value: string): boolean {
  return ISO_MONTH.test(value)
}

export function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return toIsoDate(date)
}

/** `2026-08-14` → `2026-08`. */
export function monthOf(iso: string): IsoMonth {
  return iso.slice(0, 7)
}

/** Primeiro e último dia do mês, ambos inclusivos. */
export function monthBounds(month: IsoMonth): { from: string; to: string } {
  const [year, monthNumber] = month.split('-').map(Number)
  // Dia 0 do mês seguinte é o último dia deste mês.
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` }
}

/** Segunda-feira da semana que contém a data. */
export function startOfWeek(iso: string): string {
  const weekday = parseIsoDate(iso).getUTCDay()
  // Domingo é 0 no JavaScript, mas é o fim da semana aqui, não o começo.
  const offset = weekday === 0 ? 6 : weekday - 1
  return addDays(iso, -offset)
}

/** Segunda a sexta. */
export function isBusinessDay(iso: string): boolean {
  const weekday = parseIsoDate(iso).getUTCDay()
  return weekday >= 1 && weekday <= 5
}

/**
 * Percorre o intervalo dia a dia, inclusivo nas duas pontas.
 *
 * Intervalo invertido (`to` antes de `from`) não produz nada, em vez de
 * lançar: a validação de entrada é responsabilidade de `period.ts`, e aqui um
 * intervalo vazio é a resposta correta.
 */
export function* eachDay(from: string, to: string): Generator<string> {
  let current = from
  let guard = 0

  while (current <= to && guard < MAX_DIAS_INTERVALO) {
    yield current
    current = addDays(current, 1)
    guard += 1
  }
}

/** Dias úteis no intervalo, inclusivo nas duas pontas. */
export function countBusinessDays(from: string, to: string): number {
  let total = 0
  for (const day of eachDay(from, to)) {
    if (isBusinessDay(day)) total += 1
  }
  return total
}

/** Todas as datas úteis do intervalo, em ordem crescente. */
export function listBusinessDays(from: string, to: string): string[] {
  const days: string[] = []
  for (const day of eachDay(from, to)) {
    if (isBusinessDay(day)) days.push(day)
  }
  return days
}

/**
 * Dias úteis do intervalo agrupados por mês.
 *
 * É o insumo do rateio da meta: para cada mês tocado pelo intervalo, quantos
 * dos seus dias úteis estão dentro da seleção.
 */
export function businessDaysByMonth(from: string, to: string): Map<IsoMonth, number> {
  const byMonth = new Map<IsoMonth, number>()

  for (const day of eachDay(from, to)) {
    if (!isBusinessDay(day)) continue
    const month = monthOf(day)
    byMonth.set(month, (byMonth.get(month) ?? 0) + 1)
  }

  return byMonth
}

/** Total de dias úteis de um mês inteiro — o denominador do rateio. */
export function businessDaysInMonth(month: IsoMonth): number {
  const { from, to } = monthBounds(month)
  return countBusinessDays(from, to)
}

/**
 * Os `count` últimos dias úteis terminando em `end`, inclusive.
 *
 * Caminha para trás sem se importar com o início de mês ou de período: a
 * tendência recente de um canal não é interrompida porque virou o mês.
 */
export function lastBusinessDaysUpTo(end: string, count: number): string[] {
  const days: string[] = []
  let current = end
  let guard = 0

  while (days.length < count && guard < MAX_DIAS_INTERVALO) {
    if (isBusinessDay(current)) days.unshift(current)
    current = addDays(current, -1)
    guard += 1
  }

  return days
}
