---
description: Confere se a planilha do n8n ainda casa com o contrato de dados do código
allowed-tools: Read, Glob, Grep, Bash
---

Diagnostique a fonte de dados. Serve para quando o dashboard mostra erro,
número estranho ou quando alguém mexeu na planilha.

## 1. Contrato declarado

Leia `docs/data-contract.md`, `src/lib/data/types.ts` e a constante
`REQUIRED_COLUMNS` em `src/lib/data/sheets-parser.ts`.

Aponte qualquer divergência entre os três — eles precisam concordar sobre nome,
ordem e tipo das colunas. O código é a autoridade sobre o que é aceito; o doc é
a autoridade sobre o que o n8n deve escrever.

## 2. Estado do ambiente

Rode `npm run typecheck` e `npm run test`.

Verifique quais variáveis de `.env.example` existem em `.env.local` **sem ler o
valor de nenhuma delas** — as leituras de `.env*` estão bloqueadas de propósito.
Se precisar do valor, peça para eu conferir.

## 3. Resposta da fonte

Com o servidor no ar, chame `/api/health` e informe qual `source` está ativa.

Se `source` for `mock`, diga isso com todas as letras: os números na tela são
fictícios, e nenhum diagnóstico sobre o dado real é possível nesse modo.

## 4. Relatório

Entregue, em português:

- Contrato: bate ou não bate, e onde diverge
- Fonte ativa e o que ela implica
- Causa mais provável, se houver erro, com a correção específica
- O que exige ação humana (compartilhar planilha, rotacionar credencial,
  ajustar o flow do n8n)
