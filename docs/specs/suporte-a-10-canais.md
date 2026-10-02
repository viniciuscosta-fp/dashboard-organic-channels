# Suporte a 10 canais

- **Status:** aprovada e implementada (ver `docs/decisions/0009`)
- **Data:** 2026-10-02

## Problema

Quem acompanha os canais orgânicos (marketing e comercial) vai passar de 5 para
10 canais, e o dashboard foi desenhado para 5: com 10, não dá para saber qual
canal é qual nos gráficos nem achar o canal em risco sem rolar uma tabela de 40
linhas.

O que quebra, com o código de hoje:

| Ponto               | Hoje                                            | Com 10 canais                                                           |
| ------------------- | ----------------------------------------------- | ----------------------------------------------------------------------- |
| `SERIES_COLORS`     | 5 slots (`--series-1..5`)                       | `index % 5` repete cor: cinco pares de canais com a mesma cor           |
| `globals.css`       | comentário diz "nunca reciclado"                | a regra é violada em silêncio, sem erro nem aviso                       |
| Evolução por canal  | 5 linhas em `h-64`, legenda de 5 itens          | 10 linhas sobrepostas e legenda de 10; um canal pequeno some na escala  |
| Aderência por canal | 5 canais × 4 métricas = 20 linhas               | 40 linhas com `rowSpan`; o pior canal pode estar na linha 35            |
| `ChannelPicker`     | 5 pílulas + "Todos os canais"                   | 11 pílulas: passa de duas linhas, o limite que a decisão 0006 já previu |
| Mock e testes       | 5 perfis fixos em `mock-funnel-repository.ts`   | `npm run dev` não exercita o layout de 10 canais                        |
| Docs                | "até 20 combinações por mês", "as cinco linhas" | números desatualizados                                                  |

A camada de dados **não** é o gargalo. `resolveChannels`, `computeAdherence`,
`computeRatioMatrix`, `computePeriodComparison` e o cache tratam canais como lista
de tamanho livre, e a chave de cache não depende de canal. Esta feature é de
**apresentação e de configuração**, não de cálculo.

## Escopo

**Entra:**

- Garantir que a identidade visual de cada canal não se repita quando houver 10
  (ver "Interface", Bloco A) e que o comportamento acima de 10 seja definido, não
  acidental
- Tornar legíveis com 10 canais: gráfico de evolução, seletor de canal, tabela de
  aderência por canal, tabelas de conversão e de valor
- Mock com 10 canais, determinístico, para o modo `DATA_SOURCE=mock` exercitar o
  layout
- Testes cobrindo atribuição de cor e ordenação com 10 e com mais de 10 canais
- Atualizar `docs/data-contract.md`, `docs/architecture.md`,
  `docs/setup-planilha-e-apps-script.md`, `.claude/rules/components.md` (cita
  `--series-1..3`) e registrar a decisão de layout em `docs/decisions/0009`
- Passo operacional de apontar o dashboard para a planilha nova (ver "Dados")

**Não entra:**

- Multisseleção de canais (decisão 0006 adia; reavaliar só se a solução escolhida
  para o seletor ou o gráfico precisar dela)
- Recorte por linha de negócio (`professional` / `abroad`)
- Mudança em `goal-math.ts`, em limiares ou na base de dias úteis
- Novas métricas, novas colunas ou novas abas
- Nova fonte de dados (GA4, GSC, Semrush, Postgres)
- Rota de revalidação sob demanda, feriados, autenticação
- Reescrita do Apps Script além do necessário para a lista de 10 chaves
- Edição da planilha nova, do webhook do n8n ou de qualquer sistema fora do
  repositório

## Dados necessários

**Nenhuma coluna nova.** Abas `funil`, `metas` e `canais` mantêm o contrato atual.
`docs/data-contract.md` muda só nos números e exemplos (20 → 40 combinações, "as
cinco linhas" → "as linhas dos canais"), no mesmo commit.

> Se a opção D do Bloco A (agrupar canais) for escolhida, aí sim entra coluna
> nova na aba `canais`, com cabeçalho exato `group`, e o contrato, o
> `channels-parser.ts`, o `sheets-channel-repository.ts` e o Apps Script mudam
> juntos. Ver questões em aberto.

Para a planilha duplicada funcionar, ela precisa de:

1. Abas com os nomes `funil`, `metas` e `canais`, com os cabeçalhos do contrato
2. Uma linha por dia e canal na aba `funil` (duplicata derruba a leitura, não é
   somada), com `date` como texto ISO
3. As 10 chaves na aba `canais`, com `label` e `order`. Canal com dado e sem
   cadastro aparece com a chave crua e um aviso; não quebra
4. Metas mensais na aba `metas` para os 10 canais, se houver meta
5. Compartilhamento com a service account (sem isso, `Google Sheets respondeu 403`)
6. `FUNNEL_SHEET_ID` apontando para o ID da planilha nova, em `.env.local` e, se o
   dashboard estiver publicado, na variável de ambiente do ambiente de deploy

O item 6 é operacional: `.env.local` é bloqueado para o Claude por desenho, então
a troca é feita por uma pessoa. Nenhum dado fica no código.

Volume: 10 canais × 365 dias ≈ 3.650 linhas/ano na aba `funil`, o dobro de hoje.
Continua dentro do que a leitura única da API do Sheets (cerca de 1 s) e o cache de
1 hora suportam. A confirmar no `npm run build` e numa leitura real.

Só agregados: nenhuma coluna identifica pessoa. Nada nesta feature muda isso.

## Interface

O princípio que decide tudo abaixo: **a cor não pode ser a única forma de saber
qual canal é qual**, e com 10 canais ela não tem como ser. Uma paleta categórica
com 10 tons distinguíveis por quem tem daltonismo, nos modos claro e escuro, não
existe de forma confiável — e `globals.css` já avisa que cada hex foi validado
com cuidado. Daí o trabalho de cada bloco ser decidido pelo que o leitor precisa
fazer, não por quantas cores cabem.

### Bloco A — Identidade do canal (cor)

Decisão com tradeoff real; ver questões em aberto. Opções:

| Opção | O que é                                                                                                                   | Ganha                                         | Custo                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **A** | Estender a paleta para 10 slots (`--series-6..10`)                                                                        | Nenhuma mudança de comportamento nos gráficos | Revalidar a paleta inteira em 2 modos; 10 tons ficam próximos; risco de ler errado em daltonismo |
| **B** | Cor só para o canal em foco e para os N primeiros da ordem do cadastro; demais em cinza neutro, identificados por nome    | Poucas cores, todas validáveis; foco é claro  | Canais acima de N perdem identidade por cor; depende da ordem do cadastro                        |
| **C** | Duas famílias de cor (ex.: dois conjuntos de 5) distinguidas por forma de marcador/traço (cheio, tracejado)               | 10 identidades sem 10 matizes                 | Mais complexidade em gráfico e legenda; marcador diferente em linha dá leitura mais lenta        |
| **D** | Agrupar os canais por família (ex.: busca orgânica, marca, IA) e cada grupo ganha uma matiz com variações de luminosidade | Taxonomia vira informação                     | Coluna nova `group` na aba `canais`; é decisão de negócio qual é o agrupamento                   |

Recomendação técnica, sujeita à decisão: **B**, combinada com o Bloco B (gráfico
em small multiples ou destaque). É a única que não depende de aumentar o número
de matizes distinguíveis. Qualquer opção mantém a regra existente: a cor segue o
canal, nunca a posição no ranking, e canal fora do cadastro e do dado recebe
cinza neutro.

Independentemente da opção: `seriesColorOf` **nunca** reutiliza o mesmo valor para
dois canais distintos no mesmo gráfico, e o comportamento acima do limite (11º
canal em diante) é definido e testado em vez de resultar de `% length`.

### Bloco B — Evolução por canal

Trabalho do gráfico: comparar o ritmo dos canais ao longo do período. Com 10
linhas na mesma escala, isso falha de duas formas: sobreposição e canal pequeno
colado no zero (eixo duplo é proibido, então a escala não se resolve assim).

| Opção | O que é                                                                                       | Observação                                                                  |
| ----- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **1** | Destaque: todos os canais em cinza fino, o canal em foco (ou o selecionado no gráfico) em cor | Mantém uma escala; combina com a Opção B do Bloco A                         |
| **2** | _Small multiples_: um mini-gráfico por canal, grade 2 × 5 ou 5 × 2, escala Y própria ou comum | Resolve sobreposição e canal pequeno; ocupa mais altura; tooltip por painel |
| **3** | Top N canais + "Outros" agregado                                                              | Esconde justamente canal que está caindo; exige regra de corte              |

Regras que valem para qualquer uma: todo gráfico leva tooltip; duas ou mais séries
exigem legenda ou rótulo direto; o canal em foco continua distinguível por algo
além de cor (hoje: sufixo "(em foco)" na legenda); sem eixo duplo.

### Bloco C — Seletor de canal

Trabalho do seletor: levar de "vi um canal em risco" a "abri aquele canal" em um
gesto, sem JavaScript e com a URL compartilhável (decisão 0006).

Com 11 itens as pílulas quebram em 3 ou mais linhas em telas médias e empurram o
conteúdo para baixo. Opções: manter `flex-wrap` com pílulas mais compactas;
rolagem horizontal com a pílula ativa visível; ou `<details>` com a lista (sem JS,
abre/fecha nativo). O ponto de cor só aparece onde a identidade por cor existir
(Bloco A). O rótulo em texto continua carregando a informação.

### Bloco D — Tabelas por canal

- **Aderência por canal** (`channel-goal-table.tsx`): 40 linhas é a tabela que
  mais piora. Trabalho dela: achar rápido o que está em risco. Proposta: ordenar
  os canais por gravidade de status (pior primeiro), com a ordem do cadastro como
  desempate, mantendo a coluna "Canal" ancorada durante a rolagem horizontal. Uma
  segunda proposta, a decidir, é uma linha por canal com uma métrica por vez,
  reaproveitando o `MetricTabs`, o que reduz a tabela a 10 linhas ao custo de
  esconder as outras três métricas.
- **Taxas de conversão** e **Valor por canal**: 10 linhas mais o total é aceitável
  em altura; confirmar largura das colunas de semana em tela estreita (a tabela já
  tem rolagem interna) e o cabeçalho ancorado.
- Em todas, o canal em foco continua com a linha destacada por texto ("em foco"),
  não só por cor, e `scope="row"`/`rowgroup` se mantêm.

### Bloco E — Layout geral

`page.tsx` continua sendo o único lugar que busca dados e lê relógio. O que muda é
a ordem e o agrupamento dos blocos: as comparações entre canais (hoje de cima para
baixo: evolução, conversão, valor, aderência) são as que mais crescem em altura;
vale que a **aderência por canal**, que responde "quem está em risco", suba
posição ou ganhe um resumo no topo (contagem de canais por status, com ícone e
rótulo). O esqueleto de carregamento (`DashboardSkeleton`) acompanha a nova
estrutura. O `ScopeNotice` e o escopo no `hint` de todo card não mudam.

## Critérios de aceite

Com `DATA_SOURCE=mock` e o mock estendido para 10 canais, salvo indicação:

1. `npm run verify` passa (format, lint, typecheck, test, build)
2. O mock gera 10 canais com chaves distintas e determinísticas; duas chamadas com o
   mesmo intervalo devolvem o mesmo resultado
3. Os 10 canais aparecem, com rótulo, no seletor, no gráfico de evolução e nas três
   tabelas por canal; nenhum fica oculto sem aviso na tela
4. Teste unitário: para uma ordem de 10 canais, nenhum par recebe a mesma
   identidade visual no mesmo gráfico; para uma ordem de 12, o comportamento do
   11º e do 12º é o definido na decisão do Bloco A (e não `% length`)
5. Canal fora da ordem (com meta e sem cadastro nem dado) continua em cinza neutro
6. Nenhum hex fora de `globals.css` e de `status-badge.tsx`; se a paleta for
   estendida, os novos slots passam pelo validador de contraste e daltonismo do
   skill `dataviz` nos modos claro e escuro, e o resultado é registrado em
   `docs/decisions/0009`
7. Em 1280 px de largura, o seletor ocupa no máximo duas linhas (ou o formato
   escolhido para o Bloco C); em 375 px, a página não rola horizontalmente (só as
   tabelas, dentro do próprio contêiner)
8. No gráfico de evolução, com 10 canais, é possível identificar cada série sem
   depender só da cor, e o canal em foco se distingue por texto
9. Na tabela de aderência, o canal com pior status aparece entre os primeiros sem
   rolagem vertical longa (se a ordenação por gravidade for a escolhida), e ainda
   existe um estado de texto/ícone para cada status
10. `?canal=<chave>` funciona para cada um dos 10 canais, preserva período, métrica
    e taxa, e a cor/destaque do canal é a mesma no seletor, no gráfico e nas tabelas
11. `?canal=` com uma chave que não existe continua caindo no consolidado, sem erro
12. Com 10 canais e `?canal=` ausente, o consolidado soma os 10 e a meta consolidada
    é a mesma com ou sem foco (decisão 0006, item 4)
13. Com `DATA_SOURCE=sheets` e `FUNNEL_SHEET_ID` da planilha nova (feito por uma
    pessoa): a página carrega sem `DataError`, sem aviso de "canal fora do
    cadastro", com os 10 rótulos da aba `canais`
14. `tests/architecture.test.ts` continua passando; nenhum componente importa
    `sheets-*`, `google-auth-library` ou `lib/env`
15. `docs/data-contract.md`, `docs/architecture.md`,
    `docs/setup-planilha-e-apps-script.md` e `.claude/rules/components.md` não
    citam mais "cinco canais", "20 combinações" nem `--series-1..3`
16. Os testes existentes não são afrouxados nem recebem `eslint-disable`

## Riscos e questões em aberto

**Riscos:**

- **Paleta.** Estender o categórico é o ponto mais frágil: cada hex foi validado em
  dois modos e a regra do projeto é revalidar a paleta inteira ao trocar um
- **Metas incompletas.** Se algum canal novo não tiver meta no mês, a meta
  consolidada pode ficar subestimada e o consolidado parecer melhor do que está.
  Precisa confirmar em `goal-math.ts` como `missingGoalMonths` trata a ausência
  por canal (hoje só sei que "mês sem linha não vira meta zero")
- **Coleta.** O Apps Script faz uma chamada por dia e canal, com `PAUSA_MS = 400`.
  Passando de 5 para 10 canais, o backfill leva o dobro do tempo por dia e pode
  precisar de mais retomadas dentro do limite de 4,5 minutos por execução. O
  webhook do n8n precisa aceitar as 5 chaves novas; isso não dá para verificar
  daqui
- **Altura da página.** Com 10 canais, cinco cards em sequência ficam bem mais
  longos; sem priorização, o dashboard deixa de responder "em três segundos"
- **Planilha duplicada.** Se a cópia herdou linhas duplicadas de dia e canal, ou a
  coluna `date` como data em vez de texto, a leitura falha com mensagem
  apontando a linha. `/data-check` serve para isso
- **Rollback.** O plano de desfazer é o histórico do Git. Trabalhar numa branch e
  só então mesclar em `main` torna isso um `revert` de um commit, não uma
  limpeza; o projeto exige confirmação antes de qualquer push

**Decisões tomadas (2026-10-02):**

1. **Canais:** entram mais quatro ou cinco além dos cinco atuais; chaves, rótulos
   e grupos vivem na planilha. O mock usa cinco canais fictícios para chegar a dez
2. **Cor:** agrupar por família (opção D), com a coluna `group` **opcional** na
   aba `canais`. A cor segue o grupo; o nome identifica o canal
3. **Evolução:** _small multiples_ (opção 2), um painel por canal, escala própria
4. **Aderência por canal:** quatro métricas por canal, do canal mais urgente ao
   menos
5. **Tamanho-alvo:** até 15 canais; acima disso nada quebra, só alonga a página
6. **Resumo por status no topo:** entra, como "Situação dos canais"
7. **Branch:** `feat/suporte-a-mais-canais`

Fora do escopo, registrado em `docs/decisions/0009` como gatilho de revisão:
filtro e consolidado por grupo (`?grupo=`).
