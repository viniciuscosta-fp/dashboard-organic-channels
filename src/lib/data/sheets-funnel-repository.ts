import { JWT } from 'google-auth-library'

import { getEnv, normalizePrivateKey } from '../env'
import { applyFunnelQuery } from './funnel-query'
import { FunnelDataError, type FunnelRepository } from './funnel-repository'
import { parseRows } from './sheets-parser'
import type { FunnelQuery, FunnelSnapshot } from './types'

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']

/**
 * Lê o funil de uma planilha do Google alimentada pelo n8n.
 *
 * Usa a REST API direto em vez do pacote `googleapis` porque aquele pacote
 * carrega centenas de APIs e pesa demais numa função serverless — aqui só
 * precisamos de um único endpoint de leitura.
 *
 * O cache não mora aqui: quem cacheia é `getFunnelSnapshots` em
 * funnel-service.ts, com `use cache`. Este repositório sempre bate na fonte.
 */
export class SheetsFunnelRepository implements FunnelRepository {
  readonly source = 'sheets' as const

  private client: JWT | undefined

  private getClient(): JWT {
    if (this.client) return this.client

    const env = getEnv()

    this.client = new JWT({
      email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: normalizePrivateKey(env.GOOGLE_PRIVATE_KEY!),
      scopes: SCOPES,
    })

    return this.client
  }

  async getSnapshots(query?: FunnelQuery): Promise<FunnelSnapshot[]> {
    const rows = await this.fetchRows()
    return applyFunnelQuery(parseRows(rows), query)
  }

  private async fetchRows(): Promise<string[][]> {
    const env = getEnv()
    const url = `${SHEETS_API}/${env.FUNNEL_SHEET_ID}/values/${encodeURIComponent(
      env.FUNNEL_SHEET_RANGE,
    )}?majorDimension=ROWS`

    let token: string | null | undefined
    try {
      const credentials = await this.getClient().getAccessToken()
      token = credentials.token
    } catch (cause) {
      throw new FunnelDataError(
        'Falha ao autenticar a service account no Google. Confira GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_PRIVATE_KEY.',
        this.source,
        { cause },
      )
    }

    if (!token) {
      throw new FunnelDataError(
        'Google devolveu um access token vazio para a service account.',
        this.source,
      )
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      // O cache é responsabilidade de `use cache` na camada de serviço.
      cache: 'no-store',
    })

    if (!response.ok) {
      const hint =
        response.status === 403
          ? ' Compartilhe a planilha com o e-mail da service account como Leitor.'
          : response.status === 404
            ? ' Confira FUNNEL_SHEET_ID e se a aba de FUNNEL_SHEET_RANGE existe.'
            : ''

      throw new FunnelDataError(`Google Sheets respondeu ${response.status}.${hint}`, this.source)
    }

    const payload = (await response.json()) as { values?: string[][] }
    return payload.values ?? []
  }
}
