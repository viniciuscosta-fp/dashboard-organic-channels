# Contrato de dados do funil

Este documento é o acordo entre o **flow do n8n** (que escreve) e o
**dashboard** (que lê). Mudança de um lado sem o outro quebra o dashboard.

Autoridade: o código decide o que é aceito (`src/lib/data/types.ts` e
`REQUIRED_COLUMNS` em `src/lib/data/sheets-parser.ts`); este documento decide o
que o n8n deve escrever. Os dois mudam no mesmo commit.

## Formato da planilha

Uma aba, cujo nome vai em `FUNNEL_SHEET_RANGE` (padrão: `funil!A:E`). A
**primeira linha é o cabeçalho** e é obrigatória.

| Coluna          | Tipo   | Formato                                 | Exemplo          |
| --------------- | ------ | --------------------------------------- | ---------------- |
| `date`          | texto  | ISO `AAAA-MM-DD`                        | `2026-08-01`     |
| `channel`       | texto  | identificador em minúsculas, sem acento | `organic-search` |
| `mqls`          | número | inteiro ≥ 0                             | `316`            |
| `opportunities` | número | inteiro ≥ 0                             | `84`             |
| `customers`     | número | inteiro ≥ 0                             | `24`             |

Exemplo:

```
date        channel          mqls   opportunities   customers
2026-08-01  organic-search   316    84              24
2026-08-01  direct           123    34              10
2026-08-01  referral         55     16              5
```

## Regras

**Colunas são lidas por nome, não por posição.** Reordenar é seguro; renomear
quebra. O cabeçalho é comparado sem diferenciar maiúsculas de minúsculas e
ignorando espaços nas bordas da célula — `MQLs` funciona tanto quanto `mqls`.

**Uma linha por período e canal.** `date` é a data de referência do período
(usamos o primeiro dia do mês para agregação mensal), não a data da coleta.

**Linhas em branco no fim do intervalo são ignoradas.** Linha parcialmente
preenchida, não: ela derruba a leitura com o número da linha na mensagem.

**Números são contagens inteiras.** Valor fracionado ou negativo é rejeitado —
é sinal de erro no flow, não de dado válido.

**Só agregados.** Nenhuma coluna pode identificar uma pessoa: sem nome, e-mail,
telefone, ID de contato do HubSpot ou empresa de um lead único. Esta é a
condição que torna a planilha um armazenamento aceitável — ver
[`decisions/0001`](decisions/0001-google-sheets-como-storage-v1.md).

## Adicionar uma coluna

1. Atualize a tabela acima.
2. Acrescente o campo em `FunnelSnapshot` e no schema Zod
   (`src/lib/data/types.ts`).
3. Acrescente em `REQUIRED_COLUMNS` (`src/lib/data/sheets-parser.ts`) se for
   obrigatória, com teste cobrindo ausência e valor inválido.
4. Atualize `MOCK_SNAPSHOTS` para que o modo mock continue representativo.
5. Só então ajuste o flow do n8n. O código tolera coluna extra que não está em
   `REQUIRED_COLUMNS`, então dá para publicar o código antes do flow.

## Diagnóstico

Rode `/data-check` no Claude Code, ou confira à mão:

| Sintoma                                   | Causa provável                                         |
| ----------------------------------------- | ------------------------------------------------------ |
| `Google Sheets respondeu 403`             | Planilha não compartilhada com a service account       |
| `Google Sheets respondeu 404`             | `FUNNEL_SHEET_ID` errado ou aba inexistente            |
| `Cabeçalho da planilha sem as colunas: …` | Coluna renomeada ou removida                           |
| `Linha N da planilha é inválida`          | Data fora do ISO, número vazio, negativo ou fracionado |
| Números fictícios na tela                 | `DATA_SOURCE` está em `mock`                           |
