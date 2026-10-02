import { NextResponse, type NextRequest } from 'next/server'

import { GROUP_FORM_FIELDS, groupCreationQuery } from '@/lib/channel-groups'
import { resolveChannels } from '@/lib/data/channel-catalog'
import { getChannels } from '@/lib/data/funnel-service'

/**
 * Destino do formulário "Criar grupo".
 *
 * O formulário é `GET`, sem JavaScript, e chega aqui com o estado do dashboard
 * mais o nome e os canais do grupo novo. A resposta é um redirecionamento para
 * a URL final — com o grupo gravado em `grupos` e já selecionado —, para que o
 * endereço na barra seja o estado limpo, sem os campos do formulário.
 *
 * Não há gravação em lugar nenhum: a URL é a persistência. Ver
 * docs/decisions/0010.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const destination = new URL('/', request.url)

  let channels
  try {
    channels = await getChannels()
  } catch {
    // Fonte fora do ar: volta para o dashboard com o estado que veio, e é ele
    // quem mostra o erro da fonte, com a mensagem acionável de sempre.
    const carried = new URLSearchParams(params)
    for (const field of Object.values(GROUP_FORM_FIELDS)) carried.delete(field)
    destination.search = carried.toString()
    return NextResponse.redirect(destination, 303)
  }

  const catalog = resolveChannels(channels, [])

  const query = groupCreationQuery(params.entries(), {
    knownChannels: catalog.channels.map((entry) => entry.channel),
    takenNames: catalog.groups.flatMap((group) => (group.label === null ? [] : [group.label])),
  })

  destination.search = new URLSearchParams(query).toString()

  // 303: o navegador segue com GET e não reenvia o formulário ao recarregar.
  return NextResponse.redirect(destination, 303)
}
