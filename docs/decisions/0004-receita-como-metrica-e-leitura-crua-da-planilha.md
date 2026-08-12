# 0004 — Receita como métrica e leitura crua da planilha

- **Status:** aceita
- **Data:** 2026-08-12

## Contexto

Ao ligar o dashboard à fonte real, a leitura do Apps Script existente
(`refs/appsscript-channels-automation.js`) mostrou que a origem devolve
**quatro** números por canal, não três: receita, MQLs, oportunidades e clientes.

A entrada de receita forçou duas decisões que valem registro.

## Decisão 1 — Receita é métrica, não etapa

O modelo passa a distinguir dois conjuntos:

```
METRICS       = revenue, mqls, opportunities, customers   → KPI, meta, projeção
FUNNEL_STAGES = mqls, opportunities, customers            → só o gráfico de funil
```

Toda métrica tem meta, gap, projeção e status. Só as três contagens entram no
gráfico de barras do funil.

Receita fica fora do funil porque não é um estreitamento por onde pessoas
passam: é o valor que sai da última etapa. Desenhá-la como uma barra ao lado das
outras sugeriria uma conversão que não existe, e a escala — dezenas de milhares
contra dezenas — achataria as três etapas a nada.

Consequências: a coluna `stage` da aba de metas virou `metric`; receita usa
schema decimal, já que o schema de contagem rejeita centavos; e a formatação
passa a depender da natureza da métrica, com reais em um caso e contagem no
outro.

## Decisão 2 — Ler valor cru da API, nunca o formatado

`fetchSheetValues` passa a pedir `valueRenderOption=UNFORMATTED_VALUE` e
`dateTimeRenderOption=FORMATTED_STRING`.

O padrão da API do Sheets é `FORMATTED_VALUE`, que devolve **o texto exibido**.
Com receita, uma célula formatada em reais voltaria como `"R$ 1.234,56"` — erro
visível, que o parser recusa. O caso perigoso é outro: um inteiro grande exibido
com separador de milhar volta como `"1.825"`, e a coerção numérica o interpreta
como **1,825**. O dashboard mostraria mil vezes menos sem erro nenhum.

Isso era uma falha latente desde a primeira versão. Nunca se manifestou porque
os números ainda eram pequenos e nenhuma planilha real tinha sido conectada.

`FORMATTED_STRING` para data cobre o lado oposto: sem isso, uma célula tipada
como data volta como número serial em vez de ISO. A planilha reforça isso
mantendo a coluna `date` como texto simples, e o Apps Script reaplica esse
formato ao gravar.

## Decisão 3 — Dia e canal repetidos são erro, não soma

O parser do funil recusa a planilha inteira ao encontrar `date` e `channel`
duplicados, apontando as duas linhas.

Todo cálculo do dashboard soma as linhas do período. Duas linhas do mesmo dia
dobrariam o número sem nenhum sinal — e é exatamente o que uma coleta em modo
append produz ao reprocessar um dia. Derrubar a leitura é preferível a mostrar
um número errado com aparência de certo.

O Apps Script fecha o outro lado do problema gravando por upsert.

## Consequências

O contrato de dados mudou em três pontos: a aba do funil ganhou `revenue`, a
aba de metas trocou `stage` por `metric`, e entrou a aba `canais`. Nada havia
sido carregado numa planilha real, então a migração custou zero.

## Quando revisar

- Entrar uma métrica que não seja nem contagem nem dinheiro, por exemplo uma
  taxa ou um tempo médio, que precisaria de um terceiro tipo de formatação
- A conciliação financeira passar a depender destes números, o que exigiria
  somar receita em inteiros de centavos em vez de ponto flutuante
- A origem passar a devolver mais de uma linha por dia e canal por algum
  recorte novo, o que tornaria a duplicidade legítima
