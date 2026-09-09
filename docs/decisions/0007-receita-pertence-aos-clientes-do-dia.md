# 0007 — A receita de um dia pertence aos clientes daquele dia

- **Status:** aceita
- **Data:** 2026-08-13

## Contexto

A decisão [`0005`](0005-razoes-de-fluxo-e-conversao-implicita.md) deixou uma
pergunta explicitamente em aberto, e listou a resposta dela como gatilho de
revisão: o `docs/data-contract.md` definia `revenue` apenas como "número em
reais", sem dizer **a que** aquela receita se refere.

Enquanto isso não estivesse respondido, `revenue ÷ customers` não podia ser
chamado de ticket médio. Se a coleta trouxesse receita recorrente rateada,
parcelas ou expansão de contrato antigo, o numerador se referiria a clientes de
meses anteriores e o denominador aos clientes do período — duas populações
diferentes, e a divisão não significaria "quanto vale um cliente novo".

Isso bloqueava a última métrica de valor da V2.

## Decisão

**A receita registrada num dia é a dos negócios fechados naquele dia**, os mesmos
contados em `customers`. Confirmado com quem opera a coleta.

O contrato de dados passa a dizer isso explicitamente, no mesmo lugar em que
descreve a coluna. A afirmação vale para a origem: se o webhook do n8n passar a
somar receita de outra natureza, o contrato é que foi quebrado, não o dashboard.

## O que isso autoriza

**Ticket médio** (`revenue ÷ customers`) e **receita por MQL**
(`revenue ÷ mqls`) entram como razões de valor, no mesmo caminho de código das
conversões — mesma política de nulo, mesma janela de rateio da meta, mesmo
tratamento de meta ausente. A única diferença é a unidade: reais em vez de
percentual, e um limiar de base próprio, porque a base aqui são clientes
fechados e não MQLs.

Autoriza também uma identidade que é diagnóstico de graça:

```
receita por MQL = ticket médio × conversão de MQL para cliente
```

Ela separa duas causas que, sem isso, se confundem: receita por MQL caindo
porque o canal **fecha contrato menor**, ou porque o canal **converte pior**. As
duas parcelas já estão na tela, em tabelas vizinhas. Há teste travando a
identidade.

## O que continua fora de alcance

A garantia é sobre o **dia**, não sobre o lead. Continua não havendo vínculo
entre um MQL e o cliente que ele virou, então:

- Não dá para dizer quanto valeu um MQL de março especificamente
- Ticket médio de uma janela curta continua sendo média de poucos contratos, e é
  por isso que a tabela mostra a base e apaga o número quando ela é pequena
- Receita por MQL herda a defasagem entre etapas descrita em `0005`: o numerador
  vem de clientes fechados na janela, o denominador de MQLs criados na janela, e
  eles não são as mesmas pessoas

Por isso o "Valor por canal" não tem colunas de semana. Um canal fecha poucos
clientes por semana; a média semanal seria um contrato único disfarçado de
média.

## Quando revisar

- A coleta passar a trazer receita recorrente, parcelada ou de expansão, o que
  quebra a premissa inteira
- Entrar receita negativa (estorno, cancelamento): hoje o schema a rejeita, e
  seria preciso decidir se ela pertence ao dia do estorno ou ao dia do contrato
- A conciliação financeira passar a depender destes números, o que exigiria
  somar receita em centavos inteiros em vez de ponto flutuante — o mesmo gatilho
  já registrado em [`0004`](0004-receita-como-metrica-e-leitura-crua-da-planilha.md)
