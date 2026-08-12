/**
 * Coleta diária de métricas por canal — Dashboard de Canais Orgânicos
 * ---------------------------------------------------------------------------
 * Consulta o webhook "MKT | Channels | Métricas por Canal" uma vez por dia e
 * canal, e grava na aba `funil` da planilha que hospeda este script.
 *
 * Cole este arquivo no editor de Apps Script da planilha. O passo a passo de
 * instalação, gatilhos e carga histórica está em
 * `docs/setup-planilha-e-apps-script.md`.
 *
 * Três regras sustentam a confiabilidade do dado:
 *
 *   1. UPSERT, NUNCA APPEND. Cada dia e canal ocupa uma linha só. Reexecutar
 *      qualquer intervalo corrige em vez de duplicar — e o dashboard recusa a
 *      planilha inteira se encontrar duplicata, justamente porque somar duas
 *      linhas do mesmo dia dobraria o número sem aviso.
 *
 *   2. ERRO NÃO ESCREVE. Falha de rede ou erro do webhook pula aquele par
 *      dia-canal e registra no log. Gravar zero numa falha criaria uma queda
 *      de performance que nunca aconteceu.
 *
 *   3. DATA NO FUSO DO NEGÓCIO. Tudo em America/Sao_Paulo. Em UTC, das 21h em
 *      diante o dia já virou e a coleta gravaria no dia errado.
 */

// ===================== CONFIGURAÇÃO =====================

/** Aba de destino. Precisa casar com FUNNEL_SHEET_RANGE do dashboard. */
var ABA_FUNIL = 'funil'

/** Colunas gravadas, na ordem do contrato. Ver docs/data-contract.md. */
var COLUNAS = ['date', 'channel', 'revenue', 'mqls', 'opportunities', 'customers']

/** Linha de negócio consultada. O dashboard cobre apenas `professional`. */
var LINHA = 'professional'

/** Canais coletados. Incluir um canal novo é acrescentar a chave aqui. */
var CANAIS = ['organic_site', 'blog_fluencypass', 'compare', 'brand', 'ai_referrals']

/** Pausa entre chamadas, para não martelar a HubSpot. */
var PAUSA_MS = 400

var FUSO = 'America/Sao_Paulo'

/**
 * O Apps Script encerra a execução em 6 minutos. Paramos aos 4,5 para sobrar
 * folga para gravar o progresso e agendar a retomada.
 */
var TEMPO_MAXIMO_MS = 4.5 * 60 * 1000

/** Chave da Script Property com a URL do webhook. Nunca versionar a URL. */
var PROP_WEBHOOK = 'WEBHOOK_URL'

/** Chave da Script Property que guarda o progresso do backfill. */
var PROP_BACKFILL = 'BACKFILL_ESTADO'

// ===================== FUNÇÕES PÚBLICAS =====================

/** Gatilho diário: coleta o dia anterior. */
function coletarOntem() {
  var ontem = somarDias_(hojeISO_(), -1)
  var resultado = coletarIntervalo_(ontem, ontem, Date.now())

  Logger.log(
    'Coleta de %s: %s gravados, %s com erro.',
    ontem,
    resultado.gravados,
    resultado.erros.length,
  )

  if (resultado.erros.length) Logger.log('Erros:\n' + resultado.erros.join('\n'))
}

/**
 * Regrava os últimos `dias` dias.
 *
 * Existe porque negócio no HubSpot muda retroativamente: um deal de ontem pode
 * ser requalificado hoje. Sem esta passada, o número do dia congelaria no
 * primeiro valor coletado. Semanal é frequência suficiente.
 */
function recoletarUltimosDias(dias) {
  var total = dias || 30
  var fim = somarDias_(hojeISO_(), -1)
  var inicio = somarDias_(fim, -(total - 1))

  Logger.log('Recoletando de %s a %s.', inicio, fim)
  backfill(inicio, fim)
}

/**
 * Carga histórica de um intervalo, com retomada automática.
 *
 * Chame com o intervalo desejado, por exemplo `backfill('2026-03-01',
 * '2026-08-11')`. Se não couber numa execução, o script salva o progresso e
 * agenda a continuação sozinho — acompanhe pelo log.
 */
function backfill(inicio, fim) {
  if (!ehISO_(inicio) || !ehISO_(fim)) {
    throw new Error('Use datas no formato AAAA-MM-DD. Recebi: ' + inicio + ' e ' + fim)
  }
  if (inicio > fim) throw new Error('A data inicial é posterior à final.')

  gravarEstado_({ proximo: inicio, fim: fim })
  executarBackfill_()
}

/** Chamada pelo gatilho temporário que o backfill cria. Não chame à mão. */
function continuarBackfill() {
  limparGatilhosDeRetomada_()
  executarBackfill_()
}

/** Interrompe um backfill em andamento e limpa o estado. */
function cancelarBackfill() {
  limparGatilhosDeRetomada_()
  PropertiesService.getScriptProperties().deleteProperty(PROP_BACKFILL)
  Logger.log('Backfill cancelado.')
}

// ===================== BACKFILL =====================

function executarBackfill_() {
  var estado = lerEstado_()
  if (!estado) {
    Logger.log('Nenhum backfill pendente.')
    return
  }

  var inicioExecucao = Date.now()
  var resultado = coletarIntervalo_(estado.proximo, estado.fim, inicioExecucao)

  if (resultado.erros.length) Logger.log('Erros:\n' + resultado.erros.join('\n'))

  if (resultado.concluidoAte >= estado.fim) {
    PropertiesService.getScriptProperties().deleteProperty(PROP_BACKFILL)
    Logger.log('Backfill concluído até %s. %s linhas gravadas.', estado.fim, resultado.gravados)
    return
  }

  var proximo = somarDias_(resultado.concluidoAte, 1)
  gravarEstado_({ proximo: proximo, fim: estado.fim })
  agendarRetomada_()

  Logger.log(
    'Backfill pausado em %s (limite de execução). Retoma em 1 minuto a partir de %s.',
    resultado.concluidoAte,
    proximo,
  )
}

function lerEstado_() {
  var bruto = PropertiesService.getScriptProperties().getProperty(PROP_BACKFILL)
  return bruto ? JSON.parse(bruto) : null
}

function gravarEstado_(estado) {
  PropertiesService.getScriptProperties().setProperty(PROP_BACKFILL, JSON.stringify(estado))
}

function agendarRetomada_() {
  ScriptApp.newTrigger('continuarBackfill')
    .timeBased()
    .after(60 * 1000)
    .create()
}

function limparGatilhosDeRetomada_() {
  var gatilhos = ScriptApp.getProjectTriggers()
  for (var i = 0; i < gatilhos.length; i++) {
    if (gatilhos[i].getHandlerFunction() === 'continuarBackfill') {
      ScriptApp.deleteTrigger(gatilhos[i])
    }
  }
}

// ===================== COLETA =====================

/**
 * Percorre os dias do intervalo consultando cada canal.
 *
 * Grava o que conseguiu a cada dia concluído, para que uma interrupção nunca
 * perca trabalho já feito. Devolve até onde chegou.
 */
function coletarIntervalo_(inicio, fim, inicioExecucao) {
  var erros = []
  var gravados = 0
  var concluidoAte = somarDias_(inicio, -1)
  var dia = inicio

  while (dia <= fim) {
    if (Date.now() - inicioExecucao > TEMPO_MAXIMO_MS) break

    var registros = []

    for (var i = 0; i < CANAIS.length; i++) {
      var resposta = consultarCanal_(CANAIS[i], dia)

      if (resposta.erro) {
        // Sem escrever nada: melhor um dia ausente, que o dashboard mostra como
        // ausente, do que um dia zerado que parece resultado real.
        erros.push(dia + ' / ' + CANAIS[i] + ': ' + resposta.erro)
      } else {
        registros.push(resposta.dados)
      }

      Utilities.sleep(PAUSA_MS)
    }

    if (registros.length) {
      gravarRegistros_(registros)
      gravados += registros.length
    }

    concluidoAte = dia
    dia = somarDias_(dia, 1)
  }

  return { concluidoAte: concluidoAte, gravados: gravados, erros: erros }
}

/** Consulta um canal num único dia. Devolve `{dados}` ou `{erro}`. */
function consultarCanal_(canal, dia) {
  var url = PropertiesService.getScriptProperties().getProperty(PROP_WEBHOOK)
  if (!url) return { erro: 'Script Property ' + PROP_WEBHOOK + ' não configurada.' }

  var payload = { canal: canal, linha: LINHA, start_date: dia, end_date: dia }

  try {
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    })

    var codigo = res.getResponseCode()
    if (codigo !== 200) return { erro: 'HTTP ' + codigo }

    var corpo = JSON.parse(res.getContentText() || '{}')
    if (corpo.erro) return { erro: String(corpo.erro) }

    // Ausência de campo é erro, não zero: o webhook devolver um corpo sem
    // `mqls` significa que algo mudou do outro lado, e assumir zero esconderia
    // isso até alguém estranhar o número numa reunião.
    var faltando = camposFaltando_(corpo)
    if (faltando.length) return { erro: 'resposta sem os campos: ' + faltando.join(', ') }

    return {
      dados: {
        date: dia,
        channel: canal,
        revenue: arredondar_(Number(corpo.receita)),
        mqls: Number(corpo.mqls),
        opportunities: Number(corpo.oportunidades),
        customers: Number(corpo.clientes),
      },
    }
  } catch (e) {
    return { erro: String(e) }
  }
}

function camposFaltando_(corpo) {
  var esperados = ['receita', 'mqls', 'oportunidades', 'clientes']
  var faltando = []

  for (var i = 0; i < esperados.length; i++) {
    var valor = corpo[esperados[i]]
    if (valor === undefined || valor === null || isNaN(Number(valor))) {
      faltando.push(esperados[i])
    }
  }

  return faltando
}

// ===================== ESCRITA =====================

/**
 * Grava os registros por chave `date|channel`: atualiza a linha existente ou
 * acrescenta uma nova.
 *
 * Lê e reescreve o bloco de dados de uma vez em vez de chamar a API por linha —
 * numa carga de um mês são centenas de registros, e o custo por chamada é o que
 * estoura o limite de execução.
 *
 * Colunas extras que alguém tenha acrescentado à planilha são preservadas: o
 * script só toca nas posições que mapeou.
 */
function gravarRegistros_(registros) {
  var sh = obterAba_()
  var valores = sh.getDataRange().getValues()
  var indice = mapearColunas_(valores[0])
  var largura = valores[0].length

  var posicao = {}
  for (var i = 1; i < valores.length; i++) {
    var chaveExistente = chaveDe_(valores[i][indice.date], valores[i][indice.channel])
    if (chaveExistente !== '|') posicao[chaveExistente] = i
  }

  var novas = []

  for (var j = 0; j < registros.length; j++) {
    var registro = registros[j]
    var chave = chaveDe_(registro.date, registro.channel)
    var linhaExistente = posicao[chave]

    if (linhaExistente === undefined) {
      var nova = new Array(largura)
      for (var k = 0; k < largura; k++) nova[k] = ''
      aplicarRegistro_(nova, registro, indice)
      novas.push(nova)
      // Registra a posição para o caso de o mesmo par vir duas vezes no lote.
      posicao[chave] = valores.length + novas.length - 1
      valores.push(nova)
    } else {
      aplicarRegistro_(valores[linhaExistente], registro, indice)
    }
  }

  sh.getRange(1, 1, valores.length, largura).setValues(valores)
  // A coluna de data precisa ser texto puro: como célula de data, a API do
  // Sheets a devolveria como número serial e o dashboard não a reconheceria.
  sh.getRange(2, indice.date + 1, valores.length - 1, 1).setNumberFormat('@')
}

function aplicarRegistro_(linha, registro, indice) {
  linha[indice.date] = registro.date
  linha[indice.channel] = registro.channel
  linha[indice.revenue] = registro.revenue
  linha[indice.mqls] = registro.mqls
  linha[indice.opportunities] = registro.opportunities
  linha[indice.customers] = registro.customers
}

function chaveDe_(data, canal) {
  return String(data).trim() + '|' + String(canal).trim()
}

function mapearColunas_(cabecalho) {
  var normalizado = []
  for (var i = 0; i < cabecalho.length; i++) {
    normalizado.push(String(cabecalho[i]).trim().toLowerCase())
  }

  var indice = {}
  var faltando = []

  for (var j = 0; j < COLUNAS.length; j++) {
    var posicao = normalizado.indexOf(COLUNAS[j])
    if (posicao === -1) faltando.push(COLUNAS[j])
    else indice[COLUNAS[j]] = posicao
  }

  if (faltando.length) {
    throw new Error('A aba "' + ABA_FUNIL + '" está sem as colunas: ' + faltando.join(', ') + '.')
  }

  return indice
}

/** Devolve a aba do funil, criando-a com o cabeçalho correto na primeira vez. */
function obterAba_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var sh = ss.getSheetByName(ABA_FUNIL)

  if (!sh) {
    sh = ss.insertSheet(ABA_FUNIL)
    sh.getRange(1, 1, 1, COLUNAS.length).setValues([COLUNAS]).setFontWeight('bold')
    sh.setFrozenRows(1)
    sh.getRange('A:A').setNumberFormat('@')
  }

  return sh
}

// ===================== DATAS =====================

function hojeISO_() {
  return Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd')
}

function somarDias_(iso, dias) {
  var partes = iso.split('-')
  // Meio-dia UTC evita que horário de verão empurre a data para o dia vizinho.
  var data = new Date(Date.UTC(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]), 12))
  data.setUTCDate(data.getUTCDate() + dias)

  return Utilities.formatDate(data, 'UTC', 'yyyy-MM-dd')
}

function ehISO_(valor) {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)
}

function arredondar_(n) {
  return Math.round(n * 100) / 100
}
