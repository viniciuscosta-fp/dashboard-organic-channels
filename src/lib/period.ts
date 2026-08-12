import { addDays, isIsoDate, monthBounds, monthOf } from './business-days'

export interface DateRange {
  /** Primeiro dia do período, inclusivo. ISO `AAAA-MM-DD`. */
  from: string
  /** Último dia do período, inclusivo. Pode estar no futuro. */
  to: string
}

export const PERIOD_PRESET_IDS = [
  'mes-atual',
  'mes-anterior',
  'ultimos-30-dias',
  'ultimos-90-dias',
  'trimestre-atual',
] as const

export type PeriodPresetId = (typeof PERIOD_PRESET_IDS)[number]

export const PERIOD_PRESETS: { id: PeriodPresetId; label: string }[] = [
  { id: 'mes-atual', label: 'Mês atual' },
  { id: 'mes-anterior', label: 'Mês anterior' },
  { id: 'ultimos-30-dias', label: 'Últimos 30 dias' },
  { id: 'ultimos-90-dias', label: 'Últimos 90 dias' },
  { id: 'trimestre-atual', label: 'Trimestre atual' },
]

export const DEFAULT_PRESET: PeriodPresetId = 'mes-atual'

/** Teto de segurança para intervalo personalizado vindo da URL. */
export const MAX_PERIOD_DAYS = 400

/** Fuso do negócio. O dashboard é lido no Brasil; o servidor roda em UTC. */
const BUSINESS_TIMEZONE = 'America/Sao_Paulo'

const businessDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Data de hoje no fuso do negócio, em ISO.
 *
 * Não usa UTC: das 21h em diante no horário de Brasília o dia UTC já virou, e
 * o dashboard passaria a contar um dia útil que ainda não aconteceu.
 *
 * Lê o relógio, então **nunca** deve ser chamada dentro de um escopo `use
 * cache` — a data ficaria congelada junto com o resto da entrada. O lugar dela
 * é na rota, depois de `connection()`.
 */
export function todayInBusinessTimezone(): string {
  // `en-CA` formata como AAAA-MM-DD, que é exatamente o ISO que usamos.
  return businessDateFormatter.format(new Date())
}

export interface ResolvedPeriod {
  range: DateRange
  /** `null` quando o intervalo é personalizado. */
  presetId: PeriodPresetId | null
}

function isPresetId(value: string): value is PeriodPresetId {
  return (PERIOD_PRESET_IDS as readonly string[]).includes(value)
}

function previousMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthNumber - 2, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * Traduz um preset em intervalo concreto.
 *
 * `mes-atual` e `trimestre-atual` terminam no **fim** do período, não em hoje —
 * é o que dá dias restantes para a projeção trabalhar. Já as janelas móveis
 * (`ultimos-30-dias`) terminam hoje e, por definição, não têm futuro: nelas o
 * dashboard mostra gap, mas não projeção.
 */
export function resolvePreset(id: PeriodPresetId, today: string): DateRange {
  const month = monthOf(today)

  switch (id) {
    case 'mes-atual':
      return monthBounds(month)

    case 'mes-anterior':
      return monthBounds(previousMonth(month))

    case 'ultimos-30-dias':
      return { from: addDays(today, -29), to: today }

    case 'ultimos-90-dias':
      return { from: addDays(today, -89), to: today }

    case 'trimestre-atual': {
      const [year, monthNumber] = month.split('-').map(Number)
      const firstMonthOfQuarter = Math.floor((monthNumber - 1) / 3) * 3 + 1
      const pad = (value: number) => String(value).padStart(2, '0')

      return {
        from: monthBounds(`${year}-${pad(firstMonthOfQuarter)}`).from,
        to: monthBounds(`${year}-${pad(firstMonthOfQuarter + 2)}`).to,
      }
    }
  }
}

/** Distância em dias corridos entre as pontas, inclusiva. */
function spanInDays(range: DateRange): number {
  const from = new Date(`${range.from}T00:00:00Z`).getTime()
  const to = new Date(`${range.to}T00:00:00Z`).getTime()
  return Math.round((to - from) / 86_400_000) + 1
}

export function isValidRange(range: DateRange): boolean {
  if (!isIsoDate(range.from) || !isIsoDate(range.to)) return false
  if (range.from > range.to) return false
  return spanInDays(range) <= MAX_PERIOD_DAYS
}

type SearchParamValue = string | string[] | undefined

function single(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/**
 * Resolve o período a partir dos parâmetros da URL.
 *
 * Entrada inválida **não** derruba a página: cai no preset padrão. Uma URL
 * colada errada num chat não pode quebrar o dashboard de quem abriu.
 */
export function parsePeriod(
  searchParams: Record<string, SearchParamValue>,
  today: string,
): ResolvedPeriod {
  const from = single(searchParams.de)
  const to = single(searchParams.ate)

  if (from && to) {
    const range = { from, to }
    if (isValidRange(range)) return { range, presetId: null }
  }

  const preset = single(searchParams.periodo)
  const presetId = preset && isPresetId(preset) ? preset : DEFAULT_PRESET

  return { range: resolvePreset(presetId, today), presetId }
}

/** Parâmetros de URL que reproduzem um período — usado pelos links do seletor. */
export function periodSearchParams(period: PeriodPresetId | DateRange): Record<string, string> {
  return typeof period === 'string' ? { periodo: period } : { de: period.from, ate: period.to }
}
