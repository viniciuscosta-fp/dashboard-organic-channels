# 0008 — Comparação com o período anterior equivalente

- **Status:** aceita
- **Data:** 2026-08-13

## Contexto

O dashboard dizia quanto cada canal entregou, se está aderente à meta e como
converte. Faltava a pergunta mais barata de todas: **isso é novo, ou já vinha
assim?** Sem ela, um canal em risco parece emergência mesmo quando está no mesmo
patamar do mês passado, e uma queda recente se esconde dentro de um mês que
ainda parece bom.

## Decisão 1 — A janela atual é a realizada, não o recorte

Comparamos `range.from` até a última data com dado contra os
`businessDaysElapsed` dias úteis imediatamente anteriores a `range.from`.

Este é o ponto que decide se a feature informa ou engana. Num mês de 21 dias
úteis com 8 decorridos, comparar contra os 21 dias úteis anteriores compararia
8 dias de dado contra 21 — e **todo canal apareceria despencando**, sem exceção,
todo começo de mês. O erro seria sistemático e plausível, que é a pior
combinação.

`businessDaysElapsed` já está ancorado na última data com dado, pela mesma razão
da decisão [`0003`](0003-base-de-dias-uteis-e-metodo-de-projecao.md): flow
atrasado não pode virar queda.

Ressalva registrada em `previousComparableRange`: igual número de dias úteis não
é igual composição de dias da semana. Com 10 (duas semanas cheias) é; com 7, a
janela anterior tem uma terça a mais e uma sexta a menos. É o mesmo tradeoff que
`JANELA_TENDENCIA_DIAS_UTEIS` já assume.

## Decisão 2 — Uma consulta só, com intervalo determinístico

`dataRangeWithComparisonFor` recua o suficiente para a **pior** janela anterior
possível caber. O tamanho exato dela só é conhecido depois de ler o dado — mas o
limite superior (os dias úteis do período inteiro) depende só do recorte, e é
calculável antes.

A alternativa seria uma segunda chamada a `getFunnelSnapshots` com a janela
anterior. Seria legítima quanto às regras de cache e relógio, mas
`SheetsFunnelRepository` lê a aba inteira e filtra em memória: a segunda chamada
custaria outra leitura completa da API, serializada depois da primeira, para
obter linhas que a primeira já poderia ter trazido.

Consequências verificadas:

- Uma chave de cache, uma ida à fonte. `funnel-service.ts` não mudou.
- O `to` continua limitado a hoje: dado futuro não existe em fonte nenhuma.
- O pior caso do intervalo fica em torno de 830 dias corridos, abaixo do
  `MAX_DIAS_INTERVALO` de 1200 — **com teste**, porque subir `MAX_PERIOD_DAYS`
  sem notar passaria a truncar a série em silêncio.
- Há **teste de invariância**: o `AdherenceReport` tem de ser idêntico com o
  intervalo antigo e com o novo. O intervalo maior existe só para a comparação e
  não pode mexer em nenhum número que já estava na tela.

## Decisão 3 — Sem histórico anterior, não se compara

Se a janela anterior começar antes do primeiro dado que a fonte tem, a
comparação é **recusada com motivo**, não calculada contra zeros.

Sem essa guarda, um recorte no início do histórico — hoje, fevereiro de 2026 —
leria a janela anterior como zeros e reportaria crescimento infinito em todo
canal. É o mesmo mecanismo que `computeTiming` já usa para limitar a janela de
tendência por `firstDataDate`.

A ausência vira aviso visível na régua do período, e as linhas de comparação
somem dos cartões em vez de mostrar travessões. A coluna da tabela some inteira:
uma coluna de travessões ocupa espaço e não informa nada.

## Decisão 4 — Base anterior zero não produz variação relativa

Um canal que saiu de zero para oito clientes teve variação absoluta de `+8`. A
variação **relativa** dele é indefinida, e "+800%" seria invenção. `relativeChange`
devolve `null`, e a tela mostra só o absoluto.

Isso tem um limite conhecido e aceito: os dados não distinguem **canal novo** de
**canal parado**. A aba `canais` não tem data de criação, e pedir uma coluna nova
está fora do escopo da V2. Nos dois casos a leitura é "não havia base anterior",
que é verdade nos dois.

## Decisão 5 — Onde a comparação aparece

Nos quatro cartões do topo, como uma linha a mais — inclusive quando não há meta
cadastrada, porque crescer ou cair independe de meta. E como uma coluna na
tabela por canal, que é onde a comparação vira ação.

Não entrou no gráfico, nem como segunda série no burn-up: duas curvas de
períodos diferentes no mesmo eixo temporal exigiriam alinhar dias úteis de
janelas distintas, e o ganho não paga a confusão.

Delta é sempre **absoluto e com sinal**, com a variação relativa ao lado quando
existe. O absoluto é o que sustenta a leitura; o relativo dá magnitude.

## Consequências

Entrou `period-comparison.ts` na camada de inteligência, e `ratio.ts` ganhou
`relativeChange`. `period.ts` ganhou `previousComparableRange` e
`business-days.ts` ganhou `calendarSpanForBusinessDays` — aritmética de
intervalo onde ela já morava.

O volume lido do Sheets aumentou, porque o intervalo é mais largo. O perfil de
cache não mudou.

## Quando revisar

- Alguém quiser comparar contra o **mesmo período do ano anterior** em vez do
  imediatamente anterior, o que é outra pergunta (sazonalidade) e outra janela
- A aba `canais` ganhar data de criação, o que permitiria distinguir canal novo
  de canal parado
- O histórico ficar longo o bastante para o intervalo largo se aproximar do
  `MAX_DIAS_INTERVALO`, ou `MAX_PERIOD_DAYS` subir
