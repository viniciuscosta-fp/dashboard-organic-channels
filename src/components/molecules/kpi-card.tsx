import { Card } from '@/components/atoms/card'
import { formatCount, formatRatio } from '@/lib/format'

interface KpiCardProps {
  label: string
  value: number
  /** Numerador e denominador da taxa de conversão exibida abaixo do número. */
  conversion?: { from: string; ratio: number } | null
}

/**
 * Número-herói de uma etapa do funil.
 *
 * O valor usa algarismos proporcionais — alinhamento vertical só importa em
 * coluna de tabela, e ali `tabular-nums` é aplicado.
 */
export function KpiCard({ label, value, conversion }: KpiCardProps) {
  return (
    <Card>
      <h3 className="text-ink-secondary text-xs font-medium tracking-wide uppercase">{label}</h3>
      <p className="text-ink mt-2 text-4xl font-semibold">{formatCount(value)}</p>
      {conversion ? (
        <p className="text-ink-muted mt-1 text-xs">
          {formatRatio(conversion.ratio)} de {conversion.from}
        </p>
      ) : null}
    </Card>
  )
}
