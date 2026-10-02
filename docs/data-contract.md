# Contrato de dados

Este documento é o acordo entre a **coleta** (que escreve) e o **dashboard**
(que lê). Mudança de um lado sem o outro quebra o dashboard.

Autoridade: o código decide o que é aceito (`src/lib/data/types.ts` e as
constantes de coluna nos parsers); este documento decide o que a coleta deve
escrever. Os dois mudam no mesmo commit.

Uma planilha, três abas: `funil`, `metas` e `canais`. O passo a passo de criação
está em [`setup-planilha-e-apps-script.md`](setup-planilha-e-apps-script.md).

---

## Aba `funil`

Uma linha **por dia e por canal**. Intervalo em `FUNNEL_SHEET_RANGE` (padrão
`funil!A:F`). A primeira linha é o cabeçalho e é obrigatória.

| Coluna          | Formato                                       | Exemplo        |
| --------------- | --------------------------------------------- | -------------- |
| `date`          | texto ISO `AAAA-MM-DD` — **o dia**, não o mês | `2026-08-12`   |
| `channel`       | chave do canal, igual à da aba `canais`       | `organic_site` |
| `revenue`       | número em reais, aceita centavos              | `18450.75`     |
| `mqls`          | inteiro ≥ 0                                   | `16`           |
| `opportunities` | inteiro ≥ 0                                   | `4`            |
| `customers`     | inteiro ≥ 0                                   | `1`            |

```
date        channel        revenue   mqls  opportunities  customers
2026-08-12  organic_site   18450.75  16    4              1
2026-08-12  brand           3200     4     2              1
2026-08-12  ai_referrals       0     3     1              0
```

**A coluna `date` precisa estar formatada como texto simples.** Como célula de
data, a API a devolve como número serial e o dashboard não a reconhece.

**A receita de um dia pertence aos clientes contados naquele mesmo dia.** Não é
receita recorrente rateada, nem parcela, nem expansão de contrato antigo: é o
valor dos negócios fechados no dia. É isso que torna `revenue ÷ customers` um
ticket médio de verdade, e não a divisão de duas quantidades que se referem a
grupos diferentes. Se a coleta passar a trazer receita de outra natureza, o
"Valor por canal" do dashboard deixa de significar o que diz — ver
[`decisions/0007`](decisions/0007-receita-pertence-aos-clientes-do-dia.md).

**Um dia e canal aceitam uma linha só.** Duplicata derruba a leitura apontando
as duas linhas — não é somada. Todo cálculo do dashboard soma o período, então
uma repetição dobraria o número em silêncio. Ver
[`decisions/0004`](decisions/0004-receita-como-metrica-e-leitura-crua-da-planilha.md).

**Dia sem atividade pode ser omitido.** Ausência é lida como zero, e a contagem
de dias úteis vem do calendário, nunca da quantidade de linhas. Escrever a linha
com zeros também funciona e deixa o dado mais explícito.

**A granularidade diária é requisito, não preferência.** Ritmo, tendência e
projeção de fechamento não existem sem ela.

---

## Aba `metas`

Uma linha por **mês, canal e métrica**. Intervalo em `GOALS_SHEET_RANGE` (padrão
`metas!A:D`).

| Coluna    | Formato                                           | Exemplo        |
| --------- | ------------------------------------------------- | -------------- |
| `month`   | ISO `AAAA-MM`                                     | `2026-08`      |
| `channel` | chave do canal                                    | `organic_site` |
| `metric`  | `revenue`, `mqls`, `opportunities` ou `customers` | `revenue`      |
| `target`  | número ≥ 0                                        | `59000`        |

**A meta é sempre mensal.** O dashboard rateia sozinho para o período
selecionado, proporcional aos dias úteis de cada mês — ver
[`decisions/0003`](decisions/0003-base-de-dias-uteis-e-metodo-de-projecao.md).
Não cadastre meta por semana nem por período parcial.

**Mês sem linha não vira meta zero.** O dashboard sinaliza a ausência em vez de
mostrar 100% de atingimento contra nada. São até quatro linhas por canal e mês —
40 com dez canais, 60 com quinze: preencha só o que tem meta de verdade.

Linhas duplicadas do mesmo mês, canal e métrica são **somadas**, não
sobrescritas.

---

## Aba `canais`

Uma linha por canal. Intervalo em `CHANNELS_SHEET_RANGE` (padrão `canais!A:D`).

| Coluna    | Formato                                  | Exemplo                      |
| --------- | ---------------------------------------- | ---------------------------- |
| `channel` | chave enviada ao webhook                 | `blog_fluencypass`           |
| `label`   | nome exibido no dashboard                | `Organic Search (Blog - FP)` |
| `order`   | inteiro; menor aparece antes             | `2`                          |
| `group`   | **opcional**; família do canal, ou vazio | `Orgânico`                   |

Esta aba existe para que a taxonomia de canais — quais existem, como se chamam
na tela, em que ordem aparecem, a que família pertencem — seja editável por quem
toma essa decisão, sem depender de um commit.

**`group` é opcional, na coluna e na célula.** Sem a coluna, ou com
`CHANNELS_SHEET_RANGE` ainda em `canais!A:C`, o dashboard funciona sem agrupar:
cada canal fica com a própria cor, como antes. Com ela:

- canais do mesmo grupo dividem a **cor** e a **seção** no seletor e na evolução
  por canal; o nome do canal continua sendo o que o identifica
- o grupo é comparado sem diferenciar maiúsculas nem espaços nas bordas —
  `Pago` e `pago ` são o mesmo grupo; o nome exibido é o da primeira ocorrência
- o grupo entra na tela na posição do seu primeiro canal pela `order`, e os
  canais dele vêm juntos, mesmo que a `order` os intercale
- há cinco cores de grupo; do sexto grupo em diante a cor é cinza neutro, nunca
  repetida. Canal sem grupo conta como um grupo de um canal só

O dashboard foi desenhado para até **15 canais**. Acima disso nada quebra, mas a
página fica longa. Ver [`decisions/0009`](decisions/0009-mais-canais-e-grupos.md).

**Canal cadastrado sem dado no período aparece zerado**: estar em zero é
informação. **Canal com dado e sem cadastro também aparece**, com a chave crua
como rótulo e um aviso na tela.

Incluir um canal novo são duas linhas: uma aqui e a chave, com rótulo e grupo,
na constante `CANAIS` de `scripts/apps-script/coleta-diaria.js`. O webhook precisa
aceitar a chave — sem isso a coleta registra erro e não grava o canal.

---

## Regras comuns às três abas

**Colunas são lidas por nome, não por posição.** Reordenar é seguro; renomear
quebra. O cabeçalho é comparado sem diferenciar maiúsculas de minúsculas e
ignorando espaços nas bordas da célula — `MQLs` funciona tanto quanto `mqls`.

**Linhas em branco no fim do intervalo são ignoradas.** Linha parcialmente
preenchida, não: ela derruba a leitura com o número da linha na mensagem.

**Contagens são inteiras; receita aceita centavos.** Valor negativo é rejeitado
nos dois casos — é sinal de erro na coleta, não de dado válido.

**Célula com texto formatado é recusada.** O dashboard lê o valor cru da API
(`UNFORMATTED_VALUE`), então um número é um número. Se ainda assim chegar
`R$ 1.234,56` como texto, a linha é rejeitada em vez de virar um valor errado.

**Só agregados.** Nenhuma coluna pode identificar uma pessoa: sem nome, e-mail,
telefone, ID de contato do HubSpot ou empresa de um lead único. Esta é a
condição que torna a planilha um armazenamento aceitável — ver
[`decisions/0001`](decisions/0001-google-sheets-como-storage-v1.md).

---

## Adicionar uma coluna à aba `funil`

1. Atualize a tabela acima.
2. Acrescente o campo em `FunnelSnapshot` e no schema Zod
   (`src/lib/data/types.ts`), e em `METRICS` se for uma métrica com meta.
3. Acrescente em `REQUIRED_COLUMNS` (`src/lib/data/sheets-parser.ts`), com teste
   cobrindo ausência e valor inválido.
4. Ajuste o gerador de `mock-funnel-repository.ts` para o modo mock continuar
   representativo.
5. Ajuste `COLUNAS` e o mapeamento em `scripts/apps-script/coleta-diaria.js`.
6. Só então ajuste a planilha. O código tolera coluna extra que não está na
   lista de obrigatórias, então dá para publicar o código antes.

---

## Diagnóstico

Rode `/data-check` no Claude Code, ou confira à mão:

| Sintoma                                        | Causa provável                                                  |
| ---------------------------------------------- | --------------------------------------------------------------- |
| `Google Sheets respondeu 403`                  | Planilha não compartilhada com a service account                |
| `Google Sheets respondeu 404`                  | `FUNNEL_SHEET_ID` errado, ou aba do intervalo inexistente       |
| `Cabeçalho da aba de … sem as colunas: …`      | Coluna renomeada ou removida                                    |
| `Linha N da aba de … é inválida`               | Data fora do ISO, número vazio, negativo ou fracionado          |
| `Linhas N e M … repetem …`                     | Coleta gravou em modo append; rode a coleta de novo naquele dia |
| `valor monetário inválido`                     | Célula de receita com texto formatado em vez de número          |
| `data deve estar em ISO` com número no lugar   | Coluna `date` tipada como data; formate como texto simples      |
| `sem meta cadastrada para AAAA-MM` na tela     | Falta linha na aba `metas` para aquele mês                      |
| `canal fora do cadastro` na tela               | Canal no funil sem linha na aba `canais`                        |
| `Histórico recente insuficiente para projetar` | Menos de 5 dias úteis de dado antes do último registro          |
| Números fictícios na tela                      | `DATA_SOURCE` está em `mock`                                    |
| Dashboard "atrasado" sem motivo                | Confira a data em "dados até" — a coleta pode ter parado        |
