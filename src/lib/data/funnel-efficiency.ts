import type { IsoMonth } from '../business-days'
import { listChannels, sumMetrics } from './funnel-query'
import { indexGoals, prorateGoal, type GoalIndex, type PeriodTiming } from './goal-math'
import { ratioDelta, safeRatio } from './ratio'
import {
  CONVERSION_RATIOS,
  FUNNEL_RATIO_DEFINITIONS,
  VALUE_RATIOS,
  type FunnelRatio,
  type FunnelSnapshot,
  type FunnelTotals,
  type MonthlyGoal,
  type RatioUnit,
} from './types'

/**
 * Razões do funil, por canal, contra a razão que a meta pressupõe.
 *
 * São duas naturezas com a mesma matemática: **conversão** entre etapas e
 * **valor** por unidade. Um caminho de código só serve as duas, e é isso que
 * garante que ticket médio e conversão nunca divirjam de política de nulo, de
 * janela de rateio ou de tratamento de meta ausente.
 *
 * Tudo aqui é função pura, como em `goal-math.ts`, e pelo mesmo motivo: nenhuma
 * leitura de relógio, de rede ou de ambiente. O que este arquivo acrescenta é
 * uma pergunta diferente — `goal-math.ts` compara **volume** contra meta ao
 * longo do tempo; aqui a comparação é de **razão**.
 *
 * Ver `docs/decisions/0005` para o que as conversões medem e o que não medem, e
 * `docs/decisions/0007` para o que autoriza as razões de valor.
 */

/**
 * Denominador abaixo do qual a razão existe mas oscila demais para ser lida.
 *
 * Com base `n`, um único evento move a razão em `1/n`: em 30, isso é 3,3 pontos
 * — mais que a resolução de uma casa decimal na tela. Não é um teste
 * estatístico, e não deve virar um: o processo não é binomial (há defasagem
 * entre etapas, sazonalidade semanal e arredondamento), então intervalo de
 * confiança aqui seria vestir de estatística um processo que não é. O papel
 * desta constante é só marcar a linha como frágil e deixar a base visível.
 */
export const BASE_MINIMA_CONVERSAO = 30

/**
 * O mesmo, para uma semana isolada.
 *
 * Uma semana carrega perto de um quinto da base do período, então cobrar dela o
 * mínimo do período apagaria a tabela inteira. Dez é o ponto em que um evento
 * ainda move a razão dez pontos — o suficiente para uma célula de 50% sobre duas
 * oportunidades não ser lida como igual a uma de 50% sobre duzentas.
 */
export const BASE_MINIMA_SEMANAL = 10

/**
 * O mesmo, para razões de valor.
 *
 * Ticket médio sobre um ou dois clientes não é média: é um contrato. O limiar é
 * muito menor que o das conversões porque a base aqui são clientes fechados, e
 * um canal saudável fecha dezenas por mês, não centenas.
 */
export const BASE_MINIMA_VALOR = 5

/** Limiar de base por natureza da razão. */
function minimumBase(unit: RatioUnit): number {
  return unit === 'valor' ? BASE_MINIMA_VALOR : BASE_MINIMA_CONVERSAO
}

export type BenchmarkGap =
  /** Nenhum mês da janela tem meta da métrica do numerador. */
  | 'sem-meta-numerador'
  /** Idem para o denominador — e razão sobre meta zero é indefinida. */
  | 'sem-meta-denominador'
  /** As duas métricas têm meta, mas em conjuntos de meses diferentes. */
  | 'meses-incompativeis'
  /** No consolidado: parte dos canais não tem o par completo de metas. */
  | 'cobertura-parcial-de-canais'

export interface RatioComparison {
  ratio: FunnelRatio
  /** Razão realizada na janela. `null` quando o denominador é zero. */
  actual: number | null
  /** Denominador realizado: o tamanho da base que sustenta `actual`. */
  base: number
  /** `true` quando a base é pequena demais para a razão ser lida com confiança. */
  thin: boolean
  /** Razão implícita na meta rateada. `null` quando não é comparável. */
  benchmark: number | null
  /** Por que `benchmark` é `null`. `null` quando ele existe. */
  benchmarkGap: BenchmarkGap | null
  /** `actual - benchmark`, em pontos da razão. */
  delta: number | null
  /** Canais deixados fora do benchmark. Vazio quando a razão é de um canal só. */
  excludedChannels: string[]
}

export interface ChannelRatios {
  /** Chave do canal, ou `'total'` no consolidado — convenção de `ChannelAdherence`. */
  channel: string
  totals: FunnelTotals
  ratios: Record<FunnelRatio, RatioComparison>
}

export interface RatioMatrix {
  total: ChannelRatios
  byChannel: ChannelRatios[]
}

/** Razão realizada de um par de etapas. `null` quando o denominador é zero. */
export function ratioOf(totals: FunnelTotals, ratio: FunnelRatio): number | null {
  const { numerator, denominator } = FUNNEL_RATIO_DEFINITIONS[ratio]
  return safeRatio(totals[numerator], totals[denominator])
}

/**
 * Janela de rateio de todo benchmark: a mesma que sustenta o realizado.
 *
 * O realizado cobre `range.from` até a última data com dado, que é exatamente
 * `daysByMonthElapsed`. Ponderar o benchmark por `daysByMonthTotal` compararia
 * uma razão medida em julho mais metade de agosto contra uma razão-meta
 * ponderada pelos dois meses cheios — e o delta ganharia um componente que é
 * puro calendário.
 *
 * O fallback existe porque `prorateGoal` com mapa vazio devolve `target: 0` e
 * `missingMonths` vazio, o que reportaria meta ausente num mês que tem meta. Ele
 * só entra quando não há realizado nenhum para comparar: aí o benchmark aparece
 * sozinho e não há delta.
 */
function benchmarkDays(timing: PeriodTiming): Map<IsoMonth, number> {
  return timing.businessDaysElapsed > 0 ? timing.daysByMonthElapsed : timing.daysByMonthTotal
}

interface GoalPair {
  numerator: number
  denominator: number
  /** Canais com o par completo de metas em todos os meses da janela. */
  coveredChannels: string[]
  excludedChannels: string[]
  /** Motivo pelo qual o par não serve de benchmark. `null` quando serve. */
  gap: BenchmarkGap | null
}

function sameMonths(a: readonly IsoMonth[], b: readonly IsoMonth[]): boolean {
  if (a.length !== b.length) return false
  const other = new Set(b)
  return a.every((month) => other.has(month))
}

/**
 * Por que um par de metas não serve de benchmark, olhando um canal só.
 *
 * A ordem importa. `sem-meta-*` afirma que **nenhum** mês da janela tem meta
 * daquela métrica; `meses-incompativeis` é o caso mais sutil, em que as duas
 * têm meta mas em meses diferentes — aí a razão sairia de um numerador e um
 * denominador que cobrem períodos distintos.
 */
function reasonFor(
  months: number,
  numeratorMissing: readonly IsoMonth[],
  denominatorMissing: readonly IsoMonth[],
  denominatorTarget: number,
): BenchmarkGap | null {
  if (months > 0 && denominatorMissing.length === months) return 'sem-meta-denominador'
  if (months > 0 && numeratorMissing.length === months) return 'sem-meta-numerador'

  if (numeratorMissing.length > 0 || denominatorMissing.length > 0) {
    return sameMonths(numeratorMissing, denominatorMissing)
      ? 'sem-meta-denominador'
      : 'meses-incompativeis'
  }

  // Meta cadastrada como zero no denominador é uma decisão legítima, mas uma
  // razão sobre zero continua indefinida.
  return denominatorTarget === 0 ? 'sem-meta-denominador' : null
}

/**
 * Soma as metas do par de etapas, canal por canal.
 *
 * Canal por canal, e não tudo de uma vez, por causa de uma armadilha de
 * `prorateGoal`: ele marca um mês como faltante só quando **nenhum** canal tem
 * meta nele. Num mês em que três canais têm meta de MQL e quatro têm meta de
 * oportunidade, somar de uma vez produziria uma razão entre um numerador e um
 * denominador que cobrem conjuntos de canais diferentes — e reportaria zero mês
 * faltante.
 *
 * Canal sem o par completo fica de fora e é nomeado. Somar só os cobertos
 * compararia o realizado de cinco canais contra a meta de três, então quem
 * consome recusa o benchmark quando há exclusão.
 */
function goalPairFor(
  goals: GoalIndex,
  channels: readonly string[],
  ratio: FunnelRatio,
  days: Map<IsoMonth, number>,
): GoalPair {
  const definition = FUNNEL_RATIO_DEFINITIONS[ratio]
  const months = days.size

  let numerator = 0
  let denominator = 0
  const coveredChannels: string[] = []
  const excludedChannels: string[] = []
  const reasons: (BenchmarkGap | null)[] = []

  for (const channel of channels) {
    const one = [channel]
    const numeratorGoal = prorateGoal(goals, one, definition.numerator, days)
    const denominatorGoal = prorateGoal(goals, one, definition.denominator, days)

    const reason = reasonFor(
      months,
      numeratorGoal.missingMonths,
      denominatorGoal.missingMonths,
      denominatorGoal.target,
    )
    reasons.push(reason)

    if (reason !== null) {
      excludedChannels.push(channel)
      continue
    }

    coveredChannels.push(channel)
    numerator += numeratorGoal.target
    denominator += denominatorGoal.target
  }

  let gap: BenchmarkGap | null = null
  if (coveredChannels.length === 0) {
    // Nenhum canal coberto: o motivo é o do próprio par, não uma cobertura
    // parcial. Com um canal só é o motivo dele; com vários, o primeiro motivo
    // encontrado já descreve a ausência.
    gap = reasons.find((reason) => reason !== null) ?? 'sem-meta-denominador'
  } else if (excludedChannels.length > 0) {
    gap = 'cobertura-parcial-de-canais'
  }

  return { numerator, denominator, coveredChannels, excludedChannels, gap }
}

/**
 * Uma razão realizada contra a razão implícita na meta.
 *
 * Recebe `timing` inteiro, e não um mapa de dias, de propósito: a escolha da
 * janela de rateio é decisão desta camada e não pode ser passada errada pelo
 * chamador. Ver `benchmarkDays`.
 */
export function buildRatioComparison(
  ratio: FunnelRatio,
  totals: FunnelTotals,
  goals: GoalIndex,
  channels: readonly string[],
  timing: PeriodTiming,
): RatioComparison {
  const definition = FUNNEL_RATIO_DEFINITIONS[ratio]

  const base = totals[definition.denominator]
  const actual = safeRatio(totals[definition.numerator], base)

  const pair = goalPairFor(goals, channels, ratio, benchmarkDays(timing))
  const benchmark = pair.gap === null ? safeRatio(pair.numerator, pair.denominator) : null

  return {
    ratio,
    actual,
    base,
    thin: actual !== null && base < minimumBase(definition.unit),
    benchmark,
    benchmarkGap: pair.gap,
    delta: ratioDelta(actual, benchmark),
    excludedChannels: pair.excludedChannels,
  }
}

function buildChannelRatios(
  snapshots: readonly FunnelSnapshot[],
  goals: GoalIndex,
  channels: readonly string[],
  channel: string,
  timing: PeriodTiming,
): ChannelRatios {
  const totals = sumMetrics(snapshots)

  const ratios = Object.fromEntries(
    [...CONVERSION_RATIOS, ...VALUE_RATIOS].map((ratio) => [
      ratio,
      buildRatioComparison(ratio, totals, goals, channels, timing),
    ]),
  ) as Record<FunnelRatio, RatioComparison>

  return { channel, totals, ratios }
}

export interface RatioMatrixInput {
  /** Snapshots **já recortados no período** — o mesmo `inPeriod` da rota. */
  periodSnapshots: readonly FunnelSnapshot[]
  goals: readonly MonthlyGoal[]
  /** Ordem canônica dos canais. Vazio deriva de dado ∪ metas. */
  channels?: readonly string[]
  timing: PeriodTiming
}

/**
 * Matriz completa: consolidado e por canal, as cinco razões.
 *
 * O consolidado é a razão das **somas**, nunca a média das razões dos canais. A
 * razão das somas é uma média ponderada por volume; a média simples inverte a
 * leitura quando os volumes são desiguais — um canal pequeno com razão alta
 * puxaria o consolidado para cima como se pesasse o mesmo que o maior.
 */
export function computeRatioMatrix({
  periodSnapshots,
  goals,
  channels,
  timing,
}: RatioMatrixInput): RatioMatrix {
  const index = indexGoals(goals)

  // Canais conhecidos vêm do dado **e** das metas, como em `computeAdherence`:
  // um canal com meta e sem nenhum resultado precisa aparecer, justamente por
  // estar zerado.
  const known = channels?.length
    ? [...channels]
    : [...new Set([...listChannels(periodSnapshots), ...goals.map((goal) => goal.channel)])].sort()

  const total = buildChannelRatios(periodSnapshots, index, known, 'total', timing)

  const byChannel = known.map((channel) =>
    buildChannelRatios(
      periodSnapshots.filter((snapshot) => snapshot.channel === channel),
      index,
      [channel],
      channel,
      timing,
    ),
  )

  return { total, byChannel }
}
