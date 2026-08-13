interface ScopeNoticeProps {
  /** Nome do canal em foco. `null` quando o dashboard está no consolidado. */
  channelLabel: string | null
}

/**
 * Diz, em texto, o que o canal em foco escopa e o que ele não escopa.
 *
 * Sem isto, o filtro cria a pior ambiguidade possível: os quatro números do topo
 * mudam de significado sem nenhum aviso, e quem chegou na tela por um link não
 * tem como saber se está lendo o total ou um canal. A pílula selecionada diz
 * qual canal, não diz o que mudou por causa dele.
 */
export function ScopeNotice({ channelLabel }: ScopeNoticeProps) {
  if (channelLabel === null) return null

  return (
    <p className="text-ink-secondary text-xs">
      Os números do topo, a curva acumulada e o funil mostram <strong>{channelLabel}</strong>. As
      tabelas por canal seguem completas, com a linha dele em foco — é assim que dá para comparar.
    </p>
  )
}
