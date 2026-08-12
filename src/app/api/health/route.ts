import { connection } from 'next/server'

import { getFunnelSource } from '@/lib/data/funnel-service'

/**
 * Sonda de saúde.
 *
 * `connection()` força a execução em tempo de request: um health check
 * prerenderizado no build responderia sempre a mesma coisa e não diria nada
 * sobre a instância que está no ar.
 */
export async function GET() {
  await connection()

  return Response.json({
    status: 'ok',
    source: getFunnelSource(),
  })
}
