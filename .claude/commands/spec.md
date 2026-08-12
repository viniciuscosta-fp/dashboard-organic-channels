---
description: Escreve a spec de uma feature nova em docs/specs/ antes de qualquer código
argument-hint: <slug-da-feature>
allowed-tools: Read, Write, Glob, Grep
---

Escreva a spec da feature `$1` em `docs/specs/$1.md`. **Não escreva código nesta
etapa** — a spec é o artefato, e ela é revisada antes da implementação.

Antes de escrever, leia `docs/architecture.md` e `docs/data-contract.md` para
não propor algo que já existe ou que conflita com o contrato de dados.

Se `$1` estiver vazio, pergunte qual é a feature em vez de inventar um slug.

Use exatamente esta estrutura:

```markdown
# <Título da feature>

- **Status:** rascunho
- **Data:** <AAAA-MM-DD>

## Problema

Que decisão de negócio hoje não dá para tomar com o dashboard atual. Uma frase
sobre quem sente essa falta.

## Escopo

O que entra. Depois, uma lista explícita do que **não** entra nesta feature.

## Dados necessários

Campos, granularidade e origem. Se exigir coluna nova na planilha, escreva o
cabeçalho exato e diga que `docs/data-contract.md` precisa ser atualizado junto.
Se envolver dado pessoal, pare e registre uma decisão em `docs/decisions/`.

## Interface

Onde aparece no dashboard e em que forma — KPI, série temporal, tabela,
comparação. Justifique a forma pelo trabalho que o dado faz, não por estética.

## Critérios de aceite

Lista verificável. Cada item precisa ser confirmável rodando o projeto.

## Riscos e questões em aberto

O que pode dar errado e o que ainda precisa de decisão humana.
```

Deixe explícito, ao final, o que você precisa que uma pessoa decida antes de
implementar.
