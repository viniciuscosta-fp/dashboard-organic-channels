# Planilha e coleta diária — passo a passo

Este guia vai da planilha vazia até o dashboard lendo dado real. Siga na ordem:
cada passo valida o anterior.

O formato exato das colunas está em [`data-contract.md`](data-contract.md).

---

## 1. Criar a planilha

Uma planilha do Google com **três abas**, nomeadas exatamente assim:

### Aba `funil`

Cabeçalho na linha 1:

```
date | channel | revenue | mqls | opportunities | customers
```

**Formate a coluna `date` como texto simples** — selecione a coluna A e vá em
_Formatar → Número → Texto sem formatação_.

Este passo não é cosmético. Se o Sheets tipar a célula como data, a API a
devolve como número serial em vez de `2026-08-12`, e o dashboard rejeita a
planilha inteira. O Apps Script reforça esse formato, mas fazer aqui evita a
primeira execução falhar.

### Aba `metas`

```
month | channel | metric | target
```

### Aba `canais`

```
channel | label | order
```

Preencha com os cinco canais:

| channel            | label                           | order |
| ------------------ | ------------------------------- | ----- |
| `organic_site`     | Organic Search Site             | 1     |
| `blog_fluencypass` | Organic Search (Blog - FP)      | 2     |
| `compare`          | Organic Search (Blog - Compare) | 3     |
| `brand`            | Organic Search (Brand)          | 4     |
| `ai_referrals`     | Referências de IA               | 5     |

A coluna `label` é o nome que aparece na tela. Mudar aqui muda o dashboard sem
precisar de deploy — é por isso que essa aba existe.

---

## 2. Dar acesso ao dashboard

1. No Google Cloud, crie uma **service account** e habilite a **Google Sheets API**.
2. Gere uma chave JSON para essa conta.
3. **Compartilhe a planilha** com o e-mail da service account, como **Leitor**.
4. Preencha o `.env.local` do projeto conforme o [README](../README.md), com
   `DATA_SOURCE=sheets`.

O dashboard só lê. Nenhuma rota da aplicação escreve na planilha.

---

## 3. Instalar o Apps Script

Na planilha, _Extensões → Apps Script_. Apague o conteúdo padrão e cole
[`scripts/apps-script/coleta-diaria.js`](../scripts/apps-script/coleta-diaria.js).

Depois, em _Configurações do projeto → Propriedades do script_, adicione a
propriedade `WEBHOOK_URL` com a URL do webhook do workflow "MKT · Channels ·
Métricas por Canal".

A URL fica aqui e **não** no código, porque o repositório é versionado e o
endpoint é interno.

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

Rode `backfill('2026-08-03', '2026-08-09')` com as datas que você quiser.

Confira o volume (7 dias × 5 canais = 35 linhas) e se algum dia ficou de fora.
Nesta escala tudo cabe numa execução.

### 4.4 Um mês

Rode `backfill` sobre um mês inteiro. Aqui a retomada provavelmente entra em
ação: o script pausa perto dos 4,5 minutos, grava onde parou e agenda a
continuação para um minuto depois.

Acompanhe em _Execuções_. Você deve ver `backfill` seguido de uma ou mais
`continuarBackfill`, e no log a mensagem de conclusão.

Se precisar interromper, rode `cancelarBackfill()`.

### 4.5 O resto do período

Só depois que os quatro passos acima estiverem limpos. Pode rodar de uma vez —
a retomada cuida do resto.

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

| Sintoma                                       | Causa provável                                      |
| --------------------------------------------- | --------------------------------------------------- |
| `Script Property WEBHOOK_URL não configurada` | Passo 3 incompleto                                  |
| `HTTP 401` ou `HTTP 403` no log               | URL do webhook errada ou sem acesso                 |
| `resposta sem os campos: …`                   | O webhook mudou o formato de saída                  |
| Dia faltando na planilha                      | A chamada falhou; rode `backfill` naquele intervalo |
| Execução interrompida sem retomar             | Rode `continuarBackfill()` à mão                    |
| `A aba "funil" está sem as colunas: …`        | Cabeçalho renomeado ou removido                     |
