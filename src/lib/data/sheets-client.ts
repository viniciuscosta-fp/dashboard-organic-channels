import { JWT } from 'google-auth-library'

import { getEnv, normalizePrivateKey } from '../env'
import { FunnelDataError } from './funnel-repository'

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']

/**
 * Uma linha crua da planilha.
 *
 * Com `UNFORMATTED_VALUE`, número vem como number e texto como string — a
 * célula decide o tipo, não a API.
 */
export type SheetCell = string | number | boolean | null | undefined
export type SheetRow = SheetCell[]

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
 * Como a API deve renderizar as células.
 *
 * `UNFORMATTED_VALUE` é obrigatório, não preferência. O padrão da API é
 * `FORMATTED_VALUE`, que devolve o **texto exibido**: uma célula de receita
 * formatada em reais voltaria como `"R$ 1.234,56"`, e — pior porque silencioso —
 * um inteiro com separador de milhar voltaria como `"1.825"`, que a coerção
 * numérica interpreta como 1,825. O dashboard mostraria mil vezes menos sem
 * erro nenhum.
 *
 * `FORMATTED_STRING` para data protege o outro lado: sem isso, uma célula que o
 * Sheets tenha tipado como data volta como número serial em vez de ISO. A
 * planilha ainda deve manter a coluna `date` como texto simples — ver
 * docs/data-contract.md.
 */
const RENDER_OPTIONS = 'valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING'

/**
 * Lê um intervalo em notação A1 e devolve as linhas cruas.
 *
 * Os valores chegam como `string | number | boolean` conforme o tipo da célula;
 * os parsers normalizam para texto antes de validar.
 *
 * Não cacheia: o cache é responsabilidade da camada de serviço.
 */
export async function fetchSheetValues(range: string): Promise<SheetRow[]> {
  const env = getEnv()
  const token = await getAccessToken()

  const url = `${SHEETS_API}/${env.FUNNEL_SHEET_ID}/values/${encodeURIComponent(
    range,
  )}?majorDimension=ROWS&${RENDER_OPTIONS}`

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

  const payload = (await response.json()) as { values?: SheetRow[] }
  return payload.values ?? []
}
