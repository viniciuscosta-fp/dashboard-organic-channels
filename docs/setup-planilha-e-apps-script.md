# Planilha e coleta diária — passo a passo

Este guia vai da planilha vazia até o dashboard lendo dado real. Siga na ordem:
cada passo valida o anterior.

O formato exato das colunas está em [`data-contract.md`](data-contract.md).

## Resumo

| Passo | O que fazer                                                        | Onde          |
| ----- | ------------------------------------------------------------------ | ------------- |
| 1     | Criar planilha em branco, colar o script e preencher `WEBHOOK_URL` | Google Sheets |
| 2     | Rodar `prepararPlanilha()` — cria as três abas                     | Apps Script   |
| 3     | Service account e compartilhar a planilha                          | Google Cloud  |
| 4     | Carga histórica, em etapas                                         | Apps Script   |
| 5     | Ligar os gatilhos diário e semanal                                 | Apps Script   |
| 6     | Preencher as metas do mês                                          | Google Sheets |
| 7     | Conferir de ponta a ponta                                          | Dashboard     |

Você não precisa criar aba nem digitar cabeçalho em lugar nenhum: o passo 2 faz
isso. Os passos 1 a 3 levam poucos minutos; o 4 é o que demora, e é o único que
exige atenção aos números.

O script é **autossuficiente**: as instruções de uso estão no cabeçalho do
próprio arquivo, então quem for operá-lo não precisa deste guia nem do
repositório.

---

## 1. Criar a planilha e colar o script

1. Crie uma planilha do Google **em branco**. O nome é livre.
2. _Extensões → Apps Script_. Apague o conteúdo padrão e cole
   [`scripts/apps-script/coleta-diaria.js`](../scripts/apps-script/coleta-diaria.js).
3. No topo do script, na seção **CONFIGURAÇÃO**, substitua o valor de
   `WEBHOOK_URL` pelo endereço do webhook, entre aspas:

   ```js
   var WEBHOOK_URL = 'https://webhook.exemplo.com/webhook/mkt-channels'
   ```

4. Salve.

Este é o único campo obrigatório. `CANAIS`, `LINHA` e `FUSO` já vêm preenchidos
e só mudam se a operação mudar.

> A URL fica no script, e não neste repositório: o arquivo versionado carrega
> apenas um marcador. Ao colar uma versão nova do script, lembre de preencher a
> URL de novo.

Não é preciso criar abas nem digitar cabeçalho: o próximo passo faz isso.

## 2. Montar as abas

No editor do Apps Script, selecione a função **`prepararPlanilha`** e clique em
_Executar_. Autorize os acessos quando o Google pedir — é a primeira execução.

Isso cria as três abas com o cabeçalho certo, formata a coluna `date` como texto
simples e preenche o cadastro dos cinco canais.

É seguro rodar de novo: aba existente não é recriada e dado existente não é
tocado. Rodar depois de acrescentar um canal em `CANAIS` sincroniza a aba
`canais` sem mexer nos rótulos que você tenha ajustado.

> **Por que não importar um xlsx pronto?** Porque a coluna `date` precisa ser
> texto simples, e conversão de arquivo não garante isso. Como célula de data, a
> API do Google devolve número serial em vez de `2026-08-12`, e o dashboard
> rejeita a planilha inteira. Criar pelo script elimina esse risco.

Confira que as abas `funil`, `metas` e `canais` apareceram, e que a `canais` tem
cinco linhas. A coluna `label` é o nome que aparece na tela — mudar ali muda o
dashboard sem precisar de deploy.

## 3. Dar acesso ao dashboard

1. No Google Cloud, crie uma **service account** e habilite a **Google Sheets API**.
2. Gere uma chave JSON para essa conta.
3. **Compartilhe a planilha** com o e-mail da service account, como **Leitor**.
4. Preencha o `.env.local` do projeto conforme o [README](../README.md), com
   `DATA_SOURCE=sheets`.

O dashboard só lê. Nenhuma rota da aplicação escreve na planilha.

---

## 4. Carga histórica, em etapas

O roteiro é fatiado de propósito: um erro de mapeamento aparece em cinco linhas
em vez de novecentas. Não pule etapas — cada uma valida algo diferente.

### 4.1 Um dia

No editor, rode `coletarOntem()`. Autorize os acessos quando pedido.

Confira na aba `funil`: devem ter surgido **cinco linhas**, uma por canal, com a
data de ontem. Compare os quatro números de um canal com o que a HubSpot mostra
para aquele dia.

É aqui que aparece erro de canal, de fuso ou de coluna. Se os números não
baterem, pare e investigue antes de seguir.

### 4.2 A mesma execução, de novo

Rode `coletarOntem()` outra vez.

Continua com cinco linhas, não dez. Este é o teste do upsert — o que garante
que reexecutar qualquer intervalo é seguro.

### 4.3 Uma semana

O botão _Executar_ do Apps Script não passa argumentos, então o intervalo da
carga vem de duas constantes no topo do script:

```js
var BACKFILL_INICIO = '2026-08-03'
var BACKFILL_FIM = '2026-08-09'
```

Ajuste as datas, salve, selecione **`rodarBackfill`** na lista de funções e
execute.

Confira o volume (7 dias × 5 canais = 35 linhas) e se algum dia ficou de fora.
Nesta escala tudo cabe numa execução.

### 4.4 Um mês

Mude as constantes para um mês inteiro e rode `rodarBackfill` de novo. Aqui a
retomada provavelmente entra em ação: o script pausa perto dos 4,5 minutos,
grava onde parou e agenda a continuação para um minuto depois.

Acompanhe em _Execuções_. Você deve ver `backfill` seguido de uma ou mais
`continuarBackfill`, e no log a mensagem de conclusão.

Se precisar interromper, rode `cancelarBackfill()`.

### 4.5 O resto do período

Só depois que os quatro passos acima estiverem limpos. Ajuste as constantes
para o período todo e rode uma vez — a retomada cuida do resto.

---

## 5. Ligar os gatilhos

Por último, em _Acionadores_:

| Função                 | Tipo                | Frequência            |
| ---------------------- | ------------------- | --------------------- |
| `coletarOntem`         | Orientado por tempo | Diário, entre 6h e 7h |
| `recoletarUltimosDias` | Orientado por tempo | Semanal               |

O gatilho semanal existe porque negócio no HubSpot muda retroativamente: um deal
de ontem pode ser requalificado hoje. Sem essa passada, o número do dia
congelaria no primeiro valor coletado.

> `recoletarUltimosDias` usa 30 dias quando chamada sem argumento, que é como o
> gatilho a chama.

---

## 6. Preencher as metas

Na aba `metas`, uma linha por mês, canal e métrica:

```
month     channel        metric      target
2026-08   organic_site   revenue     59000
2026-08   organic_site   customers   24
```

São até 20 combinações por mês (5 canais × 4 métricas). **Preencha só o que tem
meta de verdade.** Métrica sem linha aparece como "sem meta" no dashboard — um
estado neutro, nunca como meta zero, que renderia 100% de atingimento contra
nada.

---

## 7. Conferir de ponta a ponta

Com `DATA_SOURCE=sheets` no `.env.local`:

1. `npm run dev` e abra o dashboard.
2. Confira que "fonte: sheets" aparece no canto superior direito.
3. Selecione o mês e compare o total de uma métrica com a soma da coluna na
   planilha.
4. **Teste o modo de falha**: apague uma célula obrigatória de uma linha. O
   dashboard deve acusar o número exato da linha. Desfaça em seguida.

O passo 4 é o que prova que dado quebrado aparece como erro em vez de virar
número errado.

---

## Diagnóstico

Rode `/data-check` no Claude Code, ou consulte a tabela de sintomas em
[`data-contract.md`](data-contract.md#diagnóstico).

Erros específicos da coleta:

| Sintoma                                     | Causa provável                                                 |
| ------------------------------------------- | -------------------------------------------------------------- |
| `Preencha WEBHOOK_URL no topo deste script` | Passo 1 incompleto, ou o script foi recolado sem a URL         |
| `HTTP 401` ou `HTTP 403` no log             | URL do webhook errada ou sem acesso                            |
| `resposta sem os campos: …`                 | O webhook mudou o formato de saída                             |
| Dia faltando na planilha                    | A chamada falhou; rode `backfill` naquele intervalo            |
| Execução interrompida sem retomar           | Rode `continuarBackfill()` à mão                               |
| `A aba "funil" está sem as colunas: …`      | Cabeçalho renomeado ou removido; rode `prepararPlanilha()`     |
| Aba faltando ou cabeçalho apagado           | Rode `prepararPlanilha()` — ele recria sem tocar no que existe |
