/**
 * ============================================================================
 * COLETA DIÁRIA DE MÉTRICAS POR CANAL
 * ============================================================================
 *
 * Consulta o webhook "MKT · Channels · Métricas por Canal" e alimenta esta
 * planilha com uma linha por dia e canal. Serve de fonte para o dashboard de
 * canais orgânicos.
 *
 * Este arquivo é autossuficiente: cole no editor de Apps Script da planilha,
 * preencha WEBHOOK_URL logo abaixo e siga o roteiro. Não depende de nada
 * externo.
 *
 * ----------------------------------------------------------------------------
 * INSTALAÇÃO
 * ----------------------------------------------------------------------------
 *
 *   1. Preencha WEBHOOK_URL na seção CONFIGURAÇÃO.
 *   2. Rode `prepararPlanilha()`. Autorize os acessos que o Google pedir.
 *      Isso cria as abas `funil`, `metas` e `canais` com o cabeçalho certo.
 *   3. Rode `coletarOntem()` e confira as cinco linhas que aparecerem na aba
 *      `funil` contra o que a HubSpot mostra para o mesmo dia.
 *
 * ----------------------------------------------------------------------------
 * CARGA HISTÓRICA — faça em etapas, nesta ordem
 * ----------------------------------------------------------------------------
 *
 *   1. `coletarOntem()`                        → confira os números
 *   2. `coletarOntem()` de novo                → tem que continuar 5 linhas
 *   3. `backfill('2026-08-03','2026-08-09')`   → uma semana
 *   4. `backfill` sobre um mês                 → exercita a retomada
 *   5. `backfill` sobre o resto do período
 *
 * Cada etapa valida algo diferente. Fatiar assim faz um erro de mapeamento
 * aparecer em cinco linhas em vez de novecentas.
 *
 * ----------------------------------------------------------------------------
 * GATILHOS — só depois que a carga histórica estiver limpa
 * ----------------------------------------------------------------------------
 *
 *   `coletarOntem`          → diário, entre 6h e 7h
 *   `recoletarUltimosDias`  → semanal
 *
 * O semanal existe porque negócio no HubSpot muda retroativamente: um deal de
 * ontem pode ser requalificado hoje. Sem essa passada, o número congelaria no
 * primeiro valor coletado.
 *
 * ----------------------------------------------------------------------------
 * O QUE CADA FUNÇÃO FAZ
 * ----------------------------------------------------------------------------
 *
 *   prepararPlanilha()          Cria as três abas. Seguro rodar quantas vezes quiser.
 *   coletarOntem()              Coleta o dia anterior nos canais configurados.
 *   recoletarUltimosDias(n)     Regrava os últimos n dias (padrão 30).
 *   backfill(inicio, fim)       Carga histórica, com retomada automática.
 *   continuarBackfill()         Chamada pelo gatilho de retomada. Não chame à mão.
 *   cancelarBackfill()          Interrompe um backfill em andamento.
 *
 * ----------------------------------------------------------------------------
 * TRÊS REGRAS QUE SUSTENTAM O DADO
 * ----------------------------------------------------------------------------
 *
 *   1. UPSERT, NUNCA APPEND. Cada dia e canal ocupa uma linha só. Reexecutar
 *      qualquer intervalo corrige em vez de duplicar. O dashboard recusa a
 *      planilha inteira se achar duplicata, porque somar duas linhas do mesmo
 *      dia dobraria o número sem aviso nenhum.
 *
 *   2. ERRO NÃO ESCREVE. Falha de rede ou erro do webhook pula aquele par
 *      dia-canal e registra no log. Gravar zero numa falha criaria uma queda de
 *      performance que nunca aconteceu.
 *
 *   3. DATA NO FUSO DO BRASIL. Em UTC, das 21h em diante o dia já virou, e a
 *      coleta gravaria na data errada.
 *
 * ----------------------------------------------------------------------------
 * FORMATO DAS ABAS
 * ----------------------------------------------------------------------------
 *
 *   funil    date | channel | revenue | mqls | opportunities | customers
 *            Uma linha por dia e canal. `date` em texto simples, AAAA-MM-DD.
 *
 *   metas    month | channel | metric | target
 *            Meta mensal. `metric` é revenue, mqls, opportunities ou customers.
 *            Preencha só o que tem meta de verdade — linha ausente vira "sem
 *            meta" no dashboard, nunca meta zero.
 *
 *   canais   channel | label | order
 *            `label` é o nome que aparece na tela do dashboard.
 */

// ╔════════════════════════════════════════════════════════════════════════╗
// ║  CONFIGURAÇÃO — preencha antes de rodar qualquer coisa                 ║
// ╚════════════════════════════════════════════════════════════════════════╝

/**
 * URL do webhook de métricas por canal.
 *
 * Substitua o texto abaixo pelo endereço completo, entre aspas. Exemplo:
 * var WEBHOOK_URL = 'https://webhook.exemplo.com/webhook/mkt-channels'
 */
var WEBHOOK_URL = 'COLE_A_URL_DO_WEBHOOK_AQUI'

/**
 * Canais coletados, com o nome que aparece no dashboard.
 *
 * `chave` é o valor enviado ao webhook e precisa ser uma das chaves que ele
 * aceita. `rotulo` é livre — é o nome exibido na tela.
 *
 * Para incluir um canal novo: acrescente a linha aqui e rode
 * `prepararPlanilha()`, que sincroniza a aba `canais`.
 */
var CANAIS = [
  { chave: 'organic_site', rotulo: 'Organic Search Site' },
  { chave: 'blog_fluencypass', rotulo: 'Organic Search (Blog - FP)' },
  { chave: 'compare', rotulo: 'Organic Search (Blog - Compare)' },
  { chave: 'brand', rotulo: 'Organic Search (Brand)' },
  { chave: 'ai_referrals', rotulo: 'Referências de IA' },
]

/** Linha de negócio consultada: `professional` ou `abroad`. */
var LINHA = 'professional'

/** Fuso usado para decidir que dia é hoje. */
var FUSO = 'America/Sao_Paulo'

/** Pausa entre chamadas, em milissegundos. Aumente se aparecer rate limit. */
var PAUSA_MS = 400

// ╔════════════════════════════════════════════════════════════════════════╗
// ║  Daqui para baixo normalmente não é preciso mexer                      ║
// ╚════════════════════════════════════════════════════════════════════════╝

var ABA_FUNIL = 'funil'
var ABA_METAS = 'metas'
var ABA_CANAIS = 'canais'

var COLUNAS = ['date', 'channel', 'revenue', 'mqls', 'opportunities', 'customers']
var COLUNAS_METAS = ['month', 'channel', 'metric', 'target']
var COLUNAS_CANAIS = ['channel', 'label', 'order']

/**
 * O Apps Script encerra a execução em 6 minutos. Paramos aos 4,5 para sobrar
 * folga para gravar o progresso e agendar a retomada.
 */
var TEMPO_MAXIMO_MS = 4.5 * 60 * 1000

/** Onde o backfill guarda de onde retomar. É estado interno, não configuração. */
var NOME_PROP_BACKFILL = 'BACKFILL_ESTADO'

// ===================== FUNÇÕES PÚBLICAS =====================

/**
 * Monta a planilha: as três abas, com cabeçalho e formatação corretos.
 *
 * Rode uma vez, logo depois de colar este script. É seguro rodar de novo: aba
 * que já existe não é recriada e dado existente não é tocado — só o cadastro de
 * canais é sincronizado com a lista `CANAIS`.
 *
 * A coluna `date` fica como texto simples de propósito. Como célula de data, a
 * API do Google a devolve como número serial e o dashboard não reconhece.
 */
function prepararPlanilha() {
  var ss = SpreadsheetApp.getActiveSpreadsheet()

  var funil = criarAba_(ss, ABA_FUNIL, COLUNAS)
  // A coluna A inteira, e não só as linhas com dado: o formato precisa valer
  // para o que a coleta ainda vai escrever.
  funil.getRange('A:A').setNumberFormat('@')

  criarAba_(ss, ABA_METAS, COLUNAS_METAS)

  var canais = criarAba_(ss, ABA_CANAIS, COLUNAS_CANAIS)
  sincronizarCanais_(canais)

  removerAbaPadraoVazia_(ss)

  Logger.log(
    'Planilha pronta: abas "%s", "%s" e "%s". Cadastro com %s canais.',
    ABA_FUNIL,
    ABA_METAS,
    ABA_CANAIS,
    CANAIS.length,
  )

  if (!urlConfigurada_()) {
    Logger.log('ATENÇÃO: preencha WEBHOOK_URL no topo do script antes de coletar.')
  } else {
    Logger.log('Próximo passo: rode coletarOntem() e confira os números.')
  }
}

/** Coleta o dia anterior. É a função do gatilho diário. */
function coletarOntem() {
  var ontem = somarDias_(hojeISO_(), -1)
  var resultado = coletarIntervalo_(ontem, ontem, Date.now())

  Logger.log(
    'Coleta de %s: %s linhas gravadas, %s com erro.',
    ontem,
    resultado.gravados,
    resultado.erros.length,
  )

  if (resultado.erros.length) Logger.log('Erros:\n' + resultado.erros.join('\n'))
}

/**
 * Regrava os últimos `dias` dias. Sem argumento, usa 30.
 *
 * É a função do gatilho semanal: corrige o que a HubSpot mudou retroativamente.
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
 * Exemplo: backfill('2026-03-01', '2026-08-11')
 *
 * Se não couber numa execução, o script grava o progresso e agenda a
 * continuação sozinho. Acompanhe em Execuções.
 */
function backfill(inicio, fim) {
  if (!ehISO_(inicio) || !ehISO_(fim)) {
    throw new Error('Use datas no formato AAAA-MM-DD. Recebi: ' + inicio + ' e ' + fim)
  }
  if (inicio > fim) throw new Error('A data inicial é posterior à final.')

  gravarEstado_({ proximo: inicio, fim: fim })
  executarBackfill_()
}

/** Chamada pelo gatilho de retomada que o backfill cria. Não chame à mão. */
function continuarBackfill() {
  limparGatilhosDeRetomada_()
  executarBackfill_()
}

/** Interrompe um backfill em andamento e limpa o estado. */
function cancelarBackfill() {
  limparGatilhosDeRetomada_()
  PropertiesService.getScriptProperties().deleteProperty(NOME_PROP_BACKFILL)
  Logger.log('Backfill cancelado.')
}

// ===================== BACKFILL =====================

function executarBackfill_() {
  var estado = lerEstado_()
  if (!estado) {
    Logger.log('Nenhum backfill pendente.')
    return
  }

  var resultado = coletarIntervalo_(estado.proximo, estado.fim, Date.now())

  if (resultado.erros.length) Logger.log('Erros:\n' + resultado.erros.join('\n'))

  if (resultado.concluidoAte >= estado.fim) {
    PropertiesService.getScriptProperties().deleteProperty(NOME_PROP_BACKFILL)
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
  var bruto = PropertiesService.getScriptProperties().getProperty(NOME_PROP_BACKFILL)
  return bruto ? JSON.parse(bruto) : null
}

function gravarEstado_(estado) {
  PropertiesService.getScriptProperties().setProperty(NOME_PROP_BACKFILL, JSON.stringify(estado))
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
 * Grava a cada dia concluído, para que uma interrupção nunca perca trabalho já
 * feito. Devolve até onde chegou.
 */
function coletarIntervalo_(inicio, fim, inicioExecucao) {
  if (!urlConfigurada_()) {
    throw new Error('Preencha WEBHOOK_URL no topo deste script com a URL do webhook, entre aspas.')
  }

  var erros = []
  var gravados = 0
  var concluidoAte = somarDias_(inicio, -1)
  var dia = inicio

  while (dia <= fim) {
    if (Date.now() - inicioExecucao > TEMPO_MAXIMO_MS) break

    var registros = []

    for (var i = 0; i < CANAIS.length; i++) {
      var canal = CANAIS[i].chave
      var resposta = consultarCanal_(canal, dia)

      if (resposta.erro) {
        // Sem escrever nada: melhor um dia ausente, que o dashboard mostra como
        // ausente, do que um dia zerado que parece resultado real.
        erros.push(dia + ' / ' + canal + ': ' + resposta.erro)
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

function urlConfigurada_() {
  return typeof WEBHOOK_URL === 'string' && /^https?:\/\//i.test(WEBHOOK_URL)
}

/** Consulta um canal num único dia. Devolve `{dados}` ou `{erro}`. */
function consultarCanal_(canal, dia) {
  var payload = { canal: canal, linha: LINHA, start_date: dia, end_date: dia }

  try {
    var res = UrlFetchApp.fetch(WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    })

    var codigo = res.getResponseCode()
    if (codigo !== 200) return { erro: 'HTTP ' + codigo }

    var corpo = JSON.parse(res.getContentText() || '{}')
    if (corpo.erro) return { erro: String(corpo.erro) }

    // Campo ausente é erro, não zero: se o webhook devolver um corpo sem
    // `mqls`, algo mudou do outro lado, e assumir zero esconderia isso até
    // alguém estranhar o número numa reunião.
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
 * Lê e reescreve o bloco de uma vez em vez de chamar a API por linha — numa
 * carga de um mês são centenas de registros, e o custo por chamada é o que
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
      posicao[chave] = valores.length
      valores.push(nova)
    } else {
      aplicarRegistro_(valores[linhaExistente], registro, indice)
    }
  }

  sh.getRange(1, 1, valores.length, largura).setValues(valores)
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
    throw new Error(
      'A aba "' +
        ABA_FUNIL +
        '" está sem as colunas: ' +
        faltando.join(', ') +
        '. Rode prepararPlanilha().',
    )
  }

  return indice
}

/** Devolve a aba do funil, criando-a com o cabeçalho correto na primeira vez. */
function obterAba_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var sh = criarAba_(ss, ABA_FUNIL, COLUNAS)

  if (sh.getLastRow() <= 1) sh.getRange('A:A').setNumberFormat('@')

  return sh
}

// ===================== PREPARO DA PLANILHA =====================

/** Cria a aba com cabeçalho e linha congelada, ou devolve a existente. */
function criarAba_(ss, nome, colunas) {
  var sh = ss.getSheetByName(nome)
  if (sh) return sh

  sh = ss.insertSheet(nome)
  sh.getRange(1, 1, 1, colunas.length).setValues([colunas]).setFontWeight('bold')
  sh.setFrozenRows(1)
  sh.autoResizeColumns(1, colunas.length)

  return sh
}

/**
 * Alinha a aba `canais` com a lista `CANAIS`.
 *
 * Só acrescenta o que falta. Rótulo e ordem ajustados na planilha são
 * preservados — a aba existe justamente para essa edição não depender de código.
 */
function sincronizarCanais_(sh) {
  var valores = sh.getDataRange().getValues()
  var cadastrados = {}

  for (var i = 1; i < valores.length; i++) {
    cadastrados[String(valores[i][0]).trim()] = true
  }

  var novas = []
  for (var j = 0; j < CANAIS.length; j++) {
    if (!cadastrados[CANAIS[j].chave]) {
      novas.push([CANAIS[j].chave, CANAIS[j].rotulo, j + 1])
    }
  }

  if (novas.length) {
    sh.getRange(sh.getLastRow() + 1, 1, novas.length, COLUNAS_CANAIS.length).setValues(novas)
  }
}

/**
 * Remove a aba padrão que o Google cria com a planilha, se estiver vazia.
 *
 * A checagem é por conteúdo e não por nome, porque ela se chama "Página1" ou
 * "Sheet1" conforme o idioma da conta — e nunca apaga uma aba com dado.
 */
function removerAbaPadraoVazia_(ss) {
  var nossas = {}
  nossas[ABA_FUNIL] = true
  nossas[ABA_METAS] = true
  nossas[ABA_CANAIS] = true

  var abas = ss.getSheets()

  for (var i = 0; i < abas.length; i++) {
    var vazia = abas[i].getLastRow() === 0 && abas[i].getLastColumn() === 0

    if (!nossas[abas[i].getName()] && vazia && ss.getSheets().length > 1) {
      ss.deleteSheet(abas[i])
    }
  }
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
