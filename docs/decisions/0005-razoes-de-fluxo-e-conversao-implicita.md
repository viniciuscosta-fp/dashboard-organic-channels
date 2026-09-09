# 0005 — Razões de fluxo e conversão implícita na meta

- **Status:** aceita
- **Data:** 2026-08-13

## Contexto

A V1 respondia "quanto cada canal entregou e se está aderente à meta", mas não
"por quê". Não havia na tela nenhuma taxa de conversão por canal — e, ironia, o
número já era calculado: `StageDatum.conversionFromPrevious` existia desde a
primeira versão e nenhum componente o renderizava.

A V2 acrescenta a razão entre etapas por canal, comparada semana a semana e
contra a razão que a meta pressupõe. A restrição do pedido era dura e definiu o
desenho: **nenhuma coluna nova na planilha, nenhum dado novo, nenhuma mudança na
forma de conversar com a fonte.** Tudo aqui é derivação sobre os seis campos que
já existem.

## Decisão 1 — Isto é razão de fluxo, não conversão de coorte

`FunnelSnapshot` conta **eventos por dia**: MQLs criados no dia, oportunidades
criadas no dia, clientes fechados no dia. Não existe vínculo entre um MQL e a
oportunidade que ele virou.

Logo, `Σoportunidades / Σmqls` num período **não é a probabilidade de um MQL
virar oportunidade**. É a razão entre dois fluxos medidos na mesma janela. Com
defasagem entre etapas e volume crescente, ela subestima a conversão de coorte;
com volume caindo, superestima. Nas bordas da janela, o numerador tem pais
anteriores ao recorte e o denominador tem filhos posteriores a ele.

Isso não é corrigível com matemática. Só com dado de coorte, que não existe e
que, em nível de lead, bateria na regra 5 do `CLAUDE.md` (LGPD) — ver
[`0001`](0001-google-sheets-como-storage-v1.md).

Consequências no código e na tela:

- Os identificadores dizem `ratio`, nunca `conversionRate`
- Os rótulos dizem "MQL → Oportunidade" e o rodapé da tabela diz explicitamente
  que numerador e denominador podem pertencer a semanas diferentes
- Nada na interface é chamado de "taxa de conversão de MQL", que seria uma
  afirmação sobre coorte
- A leitura útil é **nível e direção ao longo de umas quatro semanas**, não uma
  semana contra a outra isoladamente

## Decisão 2 — A conversão implícita na meta é referência, e a premissa é registrada

Como existe meta para as quatro métricas, `meta_oportunidades / meta_mqls` é
calculável. Ela só é uma **meta de conversão** de verdade se as metas tiverem
sido derivadas umas das outras; se cada uma tiver sido cadastrada por conta
própria, a razão entre elas mede outra coisa — se o conjunto de metas é
internamente coerente com o funil que a operação consegue rodar.

O time confirmou que as metas **foram derivadas umas das outras**, partindo de
uma métrica e subindo o funil por uma taxa esperada. Sobre essa premissa, a
coluna "Meta implícita" é uma referência legítima de desempenho.

**A premissa é da decisão, não do código.** Se um ciclo de planejamento passar a
cadastrar as quatro metas de forma independente, esta coluna deixa de significar
o que diz, e esta ADR precisa ser revisada antes que alguém tome decisão em cima
dela.

Ainda assim, a coluna se chama "Meta implícita" e não "Meta de conversão": o
número é uma consequência aritmética de duas linhas da planilha, e nomeá-lo pelo
que ele é mantém a leitura honesta se a premissa mudar sem que ninguém avise.

## Decisão 3 — A janela do benchmark é a mesma que sustenta o realizado

O rateio da razão-meta usa `timing.daysByMonthElapsed`, não `daysByMonthTotal`.

O realizado cobre `range.from` até a última data com dado, que é exatamente
`daysByMonthElapsed`. Ponderar o benchmark pelo período inteiro compararia uma
razão medida em julho mais metade de agosto contra uma razão-meta ponderada
pelos dois meses cheios — e o delta ganharia um componente que é puro
calendário. É o mesmo princípio de "a mesma base de dias no rateio e na
projeção" de [`0003`](0003-base-de-dias-uteis-e-metodo-de-projecao.md).

Num período de **um mês só** — que inclui o preset padrão — o peso cancela e as
duas janelas dão o mesmo número. A escolha só morde em período multi-mês com
razões mensais de meta diferentes.

Há um fallback: quando não há nenhum dado no período, `daysByMonthElapsed` é um
mapa vazio, e `prorateGoal` com mapa vazio devolveria `target: 0` sem marcar mês
faltante — reportando meta ausente onde há meta. Nesse caso o rateio cai para o
período inteiro, o benchmark aparece sozinho e não há delta.

## Decisão 4 — O benchmark consolidado é verificado canal por canal

`prorateGoal` marca um mês como faltante só quando **nenhum** canal tem meta
nele. Somando todos os canais de uma vez, um mês em que três canais têm meta de
MQL e quatro têm meta de oportunidade produziria uma razão entre um numerador e
um denominador que cobrem conjuntos de canais diferentes — e reportaria zero mês
faltante.

`goalPairFor` itera canal a canal e exige o par completo de metas em todos os
meses da janela. Canal sem o par fica de fora e é **nomeado na tela**. Quando há
qualquer exclusão, o benchmark consolidado é recusado com
`cobertura-parcial-de-canais`: somar só os cobertos compararia o realizado de
cinco canais contra a meta de três.

Meta cadastrada **explicitamente como zero** é decisão legítima e vira benchmark
zero; ausência de linha é outra coisa e vira `null` com motivo nomeado. É a
mesma distinção que `missingGoalMonths` já fazia.

## Decisão 5 — Ausência de razão é `null`, nunca zero

`safeRatio` (`src/lib/data/ratio.ts`) é a única casa dessa política, e
`buildStageData` e `formatRate` passaram a usá-la em vez de reimplementá-la.

Denominador zero é `null` e vira travessão na tela. Numerador zero com
denominador positivo é `0` e vira "0,0%". Uma semana sem nenhum MQL apareceria
como "converteu 0%" — uma afirmação sobre o canal — quando o que houve foi
ausência do que converter.

Isso é o **inverso** da política de `buildTrendData`, que preenche zero para
intervalo sem linha. Para volume, o zero é a medição; para razão, o zero é uma
afirmação. As duas convenções convivem de propósito e estão comentadas nos dois
lugares.

## Decisão 6 — Variação de razão vai em pontos percentuais, e não recebe status

Delta de conversão usa `formatPoints`: `26% → 24%` é `−2,0 p.p.`. Chamar isso de
`−7,7%` é a forma clássica de inflar um movimento pequeno.

**Nenhuma célula de taxa recebe `StatusBadge`.** Status é vocabulário de meta de
volume, com limiares calibrados em `goal-math.ts` para atingimento. Um movimento
de quatro pontos sobre cento e vinte MQLs está dentro de qualquer noção de
ruído, e transportar o semáforo para cá transformaria ruído em alarme.

O que substitui o status é a **base**: o denominador fica visível em coluna
própria, e valores apoiados em base pequena saem em cinza —
`BASE_MINIMA_CONVERSAO` para o período, `BASE_MINIMA_SEMANAL` para uma semana
isolada. Não se calcula intervalo de confiança: o processo não é binomial (há
defasagem, sazonalidade semanal, arredondamento, e os ensaios não são
independentes), e um IC aqui seria vestir de estatística um processo que não é.

## Decisão 7 — As semanas são completas, não recortadas pelo período

Uma semana que começasse na quarta porque o período começa na quarta teria três
dias de base e mostraria uma queda que é puro truncamento.

Como `dataRangeFor` já busca 21 dias corridos antes do período para a janela de
tendência, a primeira semana se completa com dias anteriores ao recorte — sem
custo, sem uma segunda ida à fonte e sem mudar a chave de cache. Só a última
semana pode ficar incompleta, e ela vem marcada.

A tabela exibe no máximo `MAX_SEMANAS_EXIBIDAS` semanas e **diz que corta**:
corte silencioso lê como cobertura completa do período.

## Consequências

Entrou o terceiro tipo de formatação previsto como gatilho de revisão em
[`0004`](0004-receita-como-metrica-e-leitura-crua-da-planilha.md): além de
contagem e dinheiro, agora há **taxa** — percentual com uma casa, e diferença em
pontos percentuais.

Três módulos novos, todos puros e todos em `lib/**`: `ratio.ts`,
`funnel-efficiency.ts` e `dashboard-params.ts`. Nenhuma mudança em repositório,
parser, `funnel-service.ts`, `env.ts` ou contrato de dados. A rota `/` continua
como Partial Prerender.

`funnel-view.ts` ganhou o arquivo de teste que devia desde a V1.

## Quando revisar

- As metas passarem a ser cadastradas de forma independente umas das outras, o
  que esvazia a decisão 2
- Entrar dado de coorte — vínculo entre lead e oportunidade — que tornaria a
  decisão 1 desnecessária e permitiria conversão de verdade
- A defasagem entre etapas crescer a ponto de a leitura semanal virar ruído
  puro, o que exigiria elevar o agrupamento para quinzenal ou mensal
- ~~Entrar razão de valor (ticket médio, receita por MQL), que precisa de uma
  resposta que o `docs/data-contract.md` ainda não dá: se a receita do dia D
  pertence aos clientes contados no dia D~~ — respondido em
  [`0007`](0007-receita-pertence-aos-clientes-do-dia.md): pertence. As razões de
  valor entraram no mesmo caminho de código das conversões
