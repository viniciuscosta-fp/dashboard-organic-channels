import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

/** Superfície elevada padrão do dashboard: fundo, anel de 1px e cantos. */
export function Card({ children, className = '' }: CardProps) {
  return (
    <section className={`bg-surface ring-hairline rounded-xl p-5 ring-1 ${className}`.trim()}>
      {children}
    </section>
  )
}

interface CardTitleProps {
  children: ReactNode
  hint?: string
}

export function CardTitle({ children, hint }: CardTitleProps) {
  return (
    <header className="mb-4">
      <h2 className="text-ink text-sm font-semibold">{children}</h2>
      {hint ? <p className="text-ink-muted mt-0.5 text-xs">{hint}</p> : null}
    </header>
  )
}
