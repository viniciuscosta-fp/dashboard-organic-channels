import type { GoalStatus } from '@/lib/data/goal-math'

/**
 * Paleta de status, fixa e independente do tema.
 *
 * Nunca é usada sozinha: cada status carrega ícone **e** rótulo. No modo claro,
 * o amarelo de atenção fica abaixo de 3:1 contra a superfície — é o par
 * ícone + texto que sustenta a leitura, não a cor.
 */
const STATUS: Record<GoalStatus, { label: string; symbol: string; color: string }> = {
  'no-ritmo': { label: 'No ritmo', symbol: '●', color: '#0ca30c' },
  atencao: { label: 'Atenção', symbol: '▲', color: '#fab219' },
  risco: { label: 'Risco', symbol: '■', color: '#d03b3b' },
  'sem-meta': { label: 'Sem meta', symbol: '–', color: 'var(--ink-muted)' },
}

interface StatusBadgeProps {
  status: GoalStatus
  /** `sm` para uso dentro de tabela. */
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const { label, symbol, color } = STATUS[status]
  const text = size === 'sm' ? 'text-xs' : 'text-sm'

  return (
    <span className={`text-ink-secondary inline-flex items-center gap-1.5 ${text}`}>
      <span aria-hidden style={{ color }}>
        {symbol}
      </span>
      {label}
    </span>
  )
}
