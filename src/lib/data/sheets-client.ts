import { JWT } from 'google-auth-library'

import { getEnv, normalizePrivateKey } from '../env'
import { FunnelDataError } from './funnel-repository'

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']

/**
 * Cliente compartilhado de leitura do Google Sheets.
 *
 * Usa a REST API direto em vez do pacote `googleapis` porque aquele pacote
 * carrega centenas de APIs e pesa demais numa função serverless — aqui só
 * precisamos de um endpoint de leitura.
 *
 * O cliente JWT é criado uma vez por processo: a biblioteca já cacheia o access
 * token internamente e o renova sozinha quando expira.
 */
let client: JWT | undefined

function getClient(): JWT {
  if (client) return client

  const env = getEnv()

  client = new JWT({
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: normalizePrivateKey(env.GOOGLE_PRIVATE_KEY!),
    scopes: SCOPES,
  })

  return client
}

async function getAccessToken(): Promise<string> {
  let token: string | null | undefined

  try {
    const credentials = await getClient().getAccessToken()
    token = credentials.token
  } catch (cause) {
    throw new FunnelDataError(
      'Falha ao autenticar a service account no Google. Confira GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_PRIVATE_KEY.',
      'sheets',
      { cause },
    )
  }

  if (!token) {
    throw new FunnelDataError(
      'Google devolveu um access token vazio para a service account.',
      'sheets',
    )
  }

  return token
}

/**
 * Lê um intervalo em notação A1 e devolve as linhas cruas.
 *
 * Não cacheia: o cache é responsabilidade da camada de serviço.
 */
export async function fetchSheetValues(range: string): Promise<string[][]> {
  const env = getEnv()
  const token = await getAccessToken()

  const url = `${SHEETS_API}/${env.FUNNEL_SHEET_ID}/values/${encodeURIComponent(
    range,
  )}?majorDimension=ROWS`

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!response.ok) {
    const hint =
      response.status === 403
        ? ' Compartilhe a planilha com o e-mail da service account como Leitor.'
        : response.status === 404
          ? ` Confira FUNNEL_SHEET_ID e se a aba do intervalo "${range}" existe.`
          : ''

    throw new FunnelDataError(`Google Sheets respondeu ${response.status}.${hint}`, 'sheets')
  }

  const payload = (await response.json()) as { values?: string[][] }
  return payload.values ?? []
}
