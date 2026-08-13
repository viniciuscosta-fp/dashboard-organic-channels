/**
 * Política de divisão do dashboard, num lugar só.
 *
 * A regra é a mesma de `attainment` em `goal-math.ts`: **ausência de razão é
 * `null`, nunca zero**. Denominador zero virando `0` silenciosamente é o modo
 * mais fácil de o dashboard mentir — uma semana sem nenhum MQL apareceria como
 * "converteu 0%", que é uma afirmação sobre o desempenho do canal, quando o que
 * houve foi ausência do que converter.
 *
 * Módulo folha de propósito: sem nenhum import, para poder ser usado tanto pela
 * camada de inteligência quanto pela de visualização sem inverter a ordem das
 * camadas de `docs/architecture.md`.
 */

/**
 * Razão entre dois números, com denominador zero explicitado.
 *
 * `null` significa "não há razão a calcular"; `0` significa "a razão é zero".
 * As duas coisas são diferentes e a tela precisa distingui-las.
 */
export function safeRatio(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return numerator / denominator
}

/**
 * Diferença entre duas razões, em pontos da razão.
 *
 * `null` se qualquer um dos lados faltar: comparar contra o que não existe não
 * produz um zero, produz uma comparação impossível.
 */
export function ratioDelta(actual: number | null, benchmark: number | null): number | null {
  if (actual === null || benchmark === null) return null
  return actual - benchmark
}
