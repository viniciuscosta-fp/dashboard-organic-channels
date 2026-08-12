import { getEnv } from '../env'
import { applyFunnelQuery } from './funnel-query'
import type { FunnelRepository } from './funnel-repository'
import { fetchSheetValues } from './sheets-client'
import { parseRows } from './sheets-parser'
import type { FunnelQuery, FunnelSnapshot } from './types'

/**
 * Lê o funil da aba alimentada pelo n8n, uma linha por dia e canal.
 *
 * Autenticação e transporte vivem em `sheets-client.ts`, compartilhados com a
 * leitura das metas — só o intervalo e o parser mudam entre as duas abas.
 *
 * O cache não mora aqui: quem cacheia é `getFunnelSnapshots` em
 * funnel-service.ts. Este repositório sempre bate na fonte.
 */
export class SheetsFunnelRepository implements FunnelRepository {
  readonly source = 'sheets' as const

  async getSnapshots(query?: FunnelQuery): Promise<FunnelSnapshot[]> {
    const rows = await fetchSheetValues(getEnv().FUNNEL_SHEET_RANGE)
    return applyFunnelQuery(parseRows(rows), query)
  }
}
