# Contrato de dados

Este documento é o acordo entre o **flow do n8n** (que escreve) e o
**dashboard** (que lê). Mudança de um lado sem o outro quebra o dashboard.

Autoridade: o código decide o que é aceito (`src/lib/data/types.ts` e as
constantes de coluna em `sheets-parser.ts` e `goals-parser.ts`); este documento
decide o que o n8n deve escrever. Os dois mudam no mesmo commit.

São duas abas na mesma planilha: `funil` e `metas`.

---

## Aba `funil`

Uma linha **por dia e por canal**. O intervalo lido vai em `FUNNEL_SHEET_RANGE`
(padrão `funil!A:E`). A primeira linha é o cabeçalho e é obrigatória.

| Coluna          | Tipo   | Formato                                 | Exemplo          |
| --------------- | ------ | --------------------------------------- | ---------------- |
| `date`          | texto  | ISO `AAAA-MM-DD` — **o dia**, não o mês | `2026-08-12`     |
| `channel`       | texto  | identificador em minúsculas, sem acento | `organic-search` |
| `mqls`          | número | inteiro ≥ 0                             | `16`             |
| `opportunities` | número | inteiro ≥ 0                             | `4`              |
| `customers`     | número | inteiro ≥ 0                             | `1`              |

```
date        channel          mqls   opportunities   customers
2026-08-12  organic-search   16     4               1
2026-08-12  direct           6      2               0
2026-08-12  referral         3      1               0
```

**Dia sem atividade pode ser omitido.** Ausência é lida como zero, e a contagem
de dias úteis vem do calendário, nunca da quantidade de linhas. Escrever a linha
com zeros também funciona e deixa o dado mais explícito.

**A granularidade diária é requisito, não preferência.** Ritmo, tendência e
projeção de fechamento não existem sem ela. Voltar para agregado mensal
desliga metade do dashboard.

---

## Aba `metas`

Uma linha por **mês, canal e etapa**. Intervalo em `GOALS_SHEET_RANGE` (padrão
`metas!A:D`).

| Coluna    | Tipo   | Formato                                | Exemplo          |
| --------- | ------ | -------------------------------------- | ---------------- |
| `month`   | texto  | ISO `AAAA-MM`                          | `2026-08`        |
| `channel` | texto  | mesmo identificador da aba `funil`     | `organic-search` |
| `stage`   | texto  | `mqls`, `opportunities` ou `customers` | `customers`      |
| `target`  | número | inteiro ≥ 0                            | `30`             |

```
month     channel          stage           target
2026-08   organic-search   mqls            390
2026-08   organic-search   opportunities   105
2026-08   organic-search   customers       30
```

**A meta é sempre mensal.** O dashboard rateia sozinho para o período
selecionado, proporcional aos dias úteis de cada mês — ver
[`decisions/0003`](decisions/0003-base-de-dias-uteis-e-metodo-de-projecao.md).
Não cadastre meta por semana nem por período parcial.

**Mês sem linha não vira meta zero.** O dashboard sinaliza a ausência em vez de
mostrar 100% de atingimento contra nada.

Linhas duplicadas do mesmo mês, canal e etapa são **somadas**, não sobrescritas.

---

## Regras comuns às duas abas

**Colunas são lidas por nome, não por posição.** Reordenar é seguro; renomear
quebra. O cabeçalho é comparado sem diferenciar maiúsculas de minúsculas e
ignorando espaços nas bordas da célula — `MQLs` funciona tanto quanto `mqls`.

**Linhas em branco no fim do intervalo são ignoradas.** Linha parcialmente
preenchida, não: ela derruba a leitura com o número da linha na mensagem.

**Números são contagens inteiras.** Valor fracionado ou negativo é rejeitado —
é sinal de erro no flow, não de dado válido.

**Só agregados.** Nenhuma coluna pode identificar uma pessoa: sem nome, e-mail,
telefone, ID de contato do HubSpot ou empresa de um lead único. Esta é a
condição que torna a planilha um armazenamento aceitável — ver
[`decisions/0001`](decisions/0001-google-sheets-como-storage-v1.md).

---

## Adicionar uma coluna à aba `funil`

1. Atualize a tabela acima.
2. Acrescente o campo em `FunnelSnapshot` e no schema Zod
   (`src/lib/data/types.ts`).
3. Acrescente em `REQUIRED_COLUMNS` (`src/lib/data/sheets-parser.ts`) se for
   obrigatória, com teste cobrindo ausência e valor inválido.
4. Ajuste o gerador de `mock-funnel-repository.ts` para o modo mock continuar
   representativo.
5. Só então ajuste o flow do n8n. O código tolera coluna extra que não está na
   lista de obrigatórias, então dá para publicar o código antes do flow.

---

## Diagnóstico

Rode `/data-check` no Claude Code, ou confira à mão:

| Sintoma                                        | Causa provável                                            |
| ---------------------------------------------- | --------------------------------------------------------- |
| `Google Sheets respondeu 403`                  | Planilha não compartilhada com a service account          |
| `Google Sheets respondeu 404`                  | `FUNNEL_SHEET_ID` errado, ou aba do intervalo inexistente |
| `Cabeçalho da aba de … sem as colunas: …`      | Coluna renomeada ou removida                              |
| `Linha N da aba de … é inválida`               | Data fora do ISO, número vazio, negativo ou fracionado    |
| `sem meta cadastrada para AAAA-MM` na tela     | Falta linha na aba `metas` para aquele mês                |
| `Histórico recente insuficiente para projetar` | Menos de 5 dias úteis de dado antes do último registro    |
| Números fictícios na tela                      | `DATA_SOURCE` está em `mock`                              |
| Dashboard "atrasado" sem motivo                | Confira a data em "dados até" — o flow pode ter parado    |
