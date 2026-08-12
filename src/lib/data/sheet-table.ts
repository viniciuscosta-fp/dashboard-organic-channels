import { FunnelDataError } from './funnel-repository'

/**
 * Utilidades compartilhadas pelos parsers de abas da planilha.
 *
 * As abas do funil e das metas têm colunas diferentes, mas as mesmas regras de
 * leitura: cabeçalho obrigatório, mapeamento por nome e tolerância a linha em
 * branco no fim do intervalo.
 */

/** Linha totalmente vazia — normal no fim de um intervalo aberto como `A:E`. */
export function isBlankRow(row: readonly string[]): boolean {
  return row.every((cell) => (cell ?? '').trim() === '')
}

/**
 * Mapeia nome de coluna para posição.
 *
 * O mapeamento é por **nome**, nunca por posição: alguém reordenar as colunas
 * na planilha não pode trocar silenciosamente uma métrica por outra. A
 * comparação ignora caixa e espaços nas bordas da célula.
 */
export function buildColumnIndex<Column extends string>(
  header: readonly string[] | undefined,
  required: readonly Column[],
  sheetLabel: string,
): Record<Column, number> {
  if (!header) {
    throw new FunnelDataError(
      `A aba de ${sheetLabel} está vazia — nem a linha de cabeçalho foi encontrada.`,
      'sheets',
    )
  }

  const normalized = header.map((cell) => (cell ?? '').trim().toLowerCase())
  const index = {} as Record<Column, number>
  const missing: string[] = []

  for (const column of required) {
    const position = normalized.indexOf(column)
    if (position === -1) {
      missing.push(column)
      continue
    }
    index[column] = position
  }

  if (missing.length > 0) {
    throw new FunnelDataError(
      `Cabeçalho da aba de ${sheetLabel} sem as colunas: ${missing.join(', ')}. Esperado: ${required.join(', ')}. Ver docs/data-contract.md.`,
      'sheets',
    )
  }

  return index
}

/** Mensagem de erro de linha, com o número que a pessoa vê na planilha. */
export function invalidRowError(
  sheetLabel: string,
  rowOffset: number,
  issues: { path: PropertyKey[]; message: string }[],
): FunnelDataError {
  // +2 porque a linha 1 é o cabeçalho e planilhas contam a partir de 1.
  const line = rowOffset + 2
  const details = issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')

  return new FunnelDataError(
    `Linha ${line} da aba de ${sheetLabel} é inválida (${details}).`,
    'sheets',
  )
}
