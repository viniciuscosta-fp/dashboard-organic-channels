/** O que está selecionado, para dizer em texto o que mudou na tela. */
export type ScopeSelection =
  { kind: 'canal'; label: string } | { kind: 'grupo'; label: string; size: number }

interface ScopeNoticeProps {
  /** `null` quando o dashboard mostra todos os canais. */
  selection: ScopeSelection | null
}

/**
 * Diz, em texto, o que a seleção escopa e o que ela não escopa.
 *
 * Sem isto, o filtro cria a pior ambiguidade possível: os quatro números do topo
 * mudam de significado sem nenhum aviso, e quem chegou na tela por um link não
 * tem como saber se está lendo o total, um canal ou um grupo.
 *
 * Canal e grupo escopam de jeitos diferentes — ver docs/decisions/0006 e 0010 —,
 * e é exatamente isso que precisa estar escrito.
 */
export function ScopeNotice({ selection }: ScopeNoticeProps) {
  if (selection === null) return null

  if (selection.kind === 'grupo') {
    return (
      <p className="text-ink-secondary text-xs">
        Os números do topo, a curva acumulada e o funil somam os {selection.size}{' '}
        {selection.size === 1 ? 'canal' : 'canais'} do grupo <strong>{selection.label}</strong>,
        contra a soma das metas deles. Os blocos abaixo mostram só esses canais.
      </p>
    )
  }

  return (
    <p className="text-ink-secondary text-xs">
      Os números do topo, a curva acumulada e o funil mostram <strong>{selection.label}</strong>. As
      tabelas por canal seguem completas, com a linha dele em foco — é assim que dá para comparar.
    </p>
  )
}
