import type { ProjectionConfidence } from '@/lib/data/goal-math'

const CONFIDENCE_NOTE: Record<ProjectionConfidence, string | null> = {
  normal: null,
  baixa: 'Projeção de baixa confiança: pouco do período decorreu.',
  insuficiente: 'Histórico recente insuficiente para projetar.',
  'periodo-fechado': 'Período encerrado: este é o resultado final.',
}

interface ProjectionNoteProps {
  confidence: ProjectionConfidence
}

/**
 * O quanto se pode confiar na continuação estimada.
 *
 * Fica junto da curva porque é ali que a projeção é desenhada. Uma linha
 * tracejada subindo até o fim do mês parece igualmente firme quando está apoiada
 * em dez dias úteis e quando está apoiada em três — este aviso é o que separa os
 * dois casos.
 *
 * Devolve `null` quando não há nada a ressalvar: aviso que sempre aparece deixa
 * de ser lido.
 */
export function ProjectionNote({ confidence }: ProjectionNoteProps) {
  const note = CONFIDENCE_NOTE[confidence]
  if (note === null) return null

  return <p className="text-ink-muted mt-3 text-xs">{note}</p>
}
