# 0009 — Mais canais, agrupados

- **Status:** aceita
- **Data:** 2026-10-02

## Contexto

O dashboard nasceu com cinco canais orgânicos e foi desenhado para eles: cinco
slots de cor, um gráfico de evolução com uma linha por canal, uma tabela de
aderência na ordem do cadastro. O time vai passar a acompanhar perto de dez
canais, incluindo canais que não são orgânicos, e quer espaço para chegar a 15.

Com o desenho anterior, isso quebrava em quatro lugares:

- `seriesColorOf` fazia `índice % 5`: do sexto canal em diante as cores se
  repetiam, contrariando a regra "nunca reciclado" escrita em `globals.css`
- o gráfico de evolução virava um novelo de dez linhas, e um canal pequeno
  sumia colado no zero da escala do maior
- a tabela de aderência passava de 40 linhas, com o canal em risco podendo estar
  no fim dela
- o seletor de canal passava de duas linhas — o gatilho de revisão que a decisão
  0006 já tinha registrado

A camada de cálculo não era gargalo: `computeAdherence`, as razões e a comparação
com o período anterior já tratavam canais como lista de tamanho livre.

A spec está em [`specs/suporte-a-10-canais.md`](../specs/suporte-a-10-canais.md).

## Decisão 1 — Agrupar canais, com a coluna `group` opcional

A aba `canais` ganha a coluna `group`, opcional na coluna e na célula. Agrupar
foi escolha do time: é o que permite separar orgânico de pago na leitura.

Opcional porque a planilha existente, e um `CHANNELS_SHEET_RANGE` ainda em
`canais!A:C`, não podem quebrar com o deploy. Sem a coluna, cada canal é um
grupo de um canal só, e a tela se comporta como antes.

O grupo é identificado sem diferenciar maiúsculas nem espaços, para que um
`Pago` e um `pago ` digitados por pessoas diferentes não virem dois grupos.

## Decisão 2 — A cor segue o grupo, não o canal

Uma paleta categórica com dez a quinze tons distinguíveis com segurança, por
quem tem daltonismo, nos dois modos, não existe. Estender `--series-*` até 15
trocaria um problema visível (cor repetida) por um invisível (cores que parecem
iguais).

Por isso a cor passou a dizer a **família** do canal, e o **nome** do canal está
ao lado de todo ponto de cor — no seletor, nos painéis, nas tabelas. Os cinco
slots já validados bastam para cinco grupos; do sexto em diante, cinza neutro.
Nenhum hex mudou, então a paleta não precisou ser revalidada.

A cor é calculada uma vez, em `page.tsx`, por `channelColors`, e desce como
mapa. Antes cada componente recalculava a partir da ordem; agora é impossível
dois blocos discordarem da cor de um canal.

## Decisão 3 — Evolução por canal em _small multiples_

Um painel por canal, agrupados por seção, cada um com escala vertical própria.

Escala própria porque a pergunta deste bloco é a forma da curva — subindo,
caindo, parado —, e numa escala comum o canal pequeno vira uma linha reta no
zero. A comparação de volume fica com o total no título de cada painel e com as
tabelas, e uma nota sob a grade diz isso a quem lê.

Alternativas descartadas: destacar um canal sobre os outros em cinza (sem foco,
tudo cinza não informa nada) e top N mais "Outros" (esconde justamente o canal
pequeno que está caindo).

## Decisão 4 — Urgência primeiro

A tabela de aderência mantém as quatro métricas por canal, agora ordenada pelo
pior status do canal (risco, atenção, no ritmo, sem meta), com a ordem canônica
como desempate. Como a ordem deixa de juntar os canais do mesmo grupo, o nome do
grupo aparece sob o nome do canal.

Um bloco novo, "Situação dos canais", logo abaixo dos cartões, conta os canais
em cada status, lista quais são e as métricas que os puseram ali. Cada nome é
link para pôr o canal em foco — o gesto seguinte natural, sem JavaScript.

O pior status de um canal ignora métrica sem meta quando outra tem régua: o
canal só é "sem meta" se nenhuma métrica dele tiver meta.

## Decisão 5 — Os blocos escopados pelo foco ficam juntos

A curva acumulada e as etapas do funil — os dois blocos que o foco em um canal
escopa, além dos cartões — passaram a dividir uma linha logo abaixo do resumo.
Tudo o que vem depois é "Todos os canais". As regras da decisão 0006 seguem
valendo: `ScopeNotice` e o escopo no `hint` de todo card.

## Consequências

- `ResolvedChannel` ganhou `group`; `ChannelCatalog` ganhou `groups`
- `seriesColorOf(order, channel)` deu lugar a `channelColors(catalog)` e
  `colorOf(colors, channel)`; os componentes recebem `colors` em vez de `order`
- `ChannelTrendChart` deu lugar a `ChannelTrendGrid`
- O mock passou a ter dez canais em três grupos, cinco deles fictícios, com a
  `order` intercalada para exercitar o agrupamento
- O padrão de `CHANNELS_SHEET_RANGE` passou a `canais!A:D`
- O Apps Script grava o grupo no cadastro e acrescenta o cabeçalho `group` à
  aba antiga

## Quando revisar

- Mais de cinco grupos: o sexto já sai cinza, e precisaria de paleta nova
- Mais de 15 canais: a página continua funcionando, mas fica longa, e um filtro
  por grupo (`?grupo=`) passaria a valer o custo
- Alguém precisar do consolidado de um grupo só (todo o orgânico, todo o pago):
  hoje o consolidado soma todos os canais, de todos os grupos
