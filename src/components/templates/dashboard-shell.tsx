import type { ReactNode } from 'react'

interface DashboardShellProps {
  title: string
  subtitle: string
  /** Etiqueta da fonte de dados ativa, ex.: `mock` ou `sheets`. */
  source: string
  children: ReactNode
}

export function DashboardShell({ title, subtitle, source, children }: DashboardShellProps) {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-ink text-2xl font-semibold">{title}</h1>
          <p className="text-ink-secondary mt-1 text-sm">{subtitle}</p>
        </div>
        <span className="ring-hairline text-ink-muted rounded-full px-2.5 py-1 font-mono text-xs ring-1">
          fonte: {source}
        </span>
      </header>

      <div className="space-y-6">{children}</div>
    </main>
  )
}
