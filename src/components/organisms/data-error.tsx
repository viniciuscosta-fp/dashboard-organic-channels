import { Card } from '@/components/atoms/card'

interface DataErrorProps {
  message: string
}

/**
 * Estado de erro da fonte de dados.
 *
 * Mostra a mensagem real em vez de um "algo deu errado": as falhas prováveis
 * aqui — planilha não compartilhada, coluna renomeada, credencial expirada —
 * são todas acionáveis por quem estiver olhando o dashboard.
 */
export function DataError({ message }: DataErrorProps) {
  return (
    <Card className="border-l-4 border-l-[#d03b3b]">
      <h2 className="text-ink flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden>⚠</span>
        Não foi possível carregar o funil
      </h2>
      <p className="text-ink-secondary mt-2 text-sm">{message}</p>
      <p className="text-ink-muted mt-3 text-xs">
        Os dados não foram cacheados — recarregar a página tenta de novo.
      </p>
    </Card>
  )
}
