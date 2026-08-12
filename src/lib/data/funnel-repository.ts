import type { FunnelQuery, FunnelSnapshot } from './types'

export type FunnelDataSource = 'mock' | 'sheets'

/**
 * Contrato único de acesso aos dados do funil.
 *
 * Esta interface existe para que a UI nunca conheça a fonte. Na V1 a fonte é
 * uma planilha alimentada pelo n8n; quando GA4, GSC e Semrush entrarem e o
 * volume justificar um banco, basta uma nova implementação — nenhum
 * componente muda. Ver docs/decisions/0001.
 */
export interface FunnelRepository {
  /** Identifica a implementação ativa. Exposto em /api/health para diagnóstico. */
  readonly source: FunnelDataSource

  /**
   * Devolve os snapshots agregados que satisfazem a query, ordenados por
   * data e depois por canal.
   */
  getSnapshots(query?: FunnelQuery): Promise<FunnelSnapshot[]>
}

/**
 * Erro de leitura da fonte de dados.
 *
 * Tipo próprio para que a UI distinga "a fonte falhou" de um bug de
 * programação, e possa renderizar um estado de erro útil.
 */
export class FunnelDataError extends Error {
  constructor(
    message: string,
    readonly source: FunnelDataSource,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'FunnelDataError'
  }
}
