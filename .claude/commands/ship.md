---
description: Roda a verificação completa e prepara os commits do trabalho atual
allowed-tools: Bash, Read, Glob, Grep, Edit
---

Feche o trabalho atual, nesta ordem. **Não pule etapa e não commite com
verificação vermelha.**

## 1. Verificar

Rode `npm run verify` (formatação, lint, typecheck, testes e build).

Se algo falhar: corrija a causa e rode de novo. Nunca relaxe uma regra de lint,
afrouxe um teste ou adicione `eslint-disable` para fazer o comando passar — se
a regra parecer errada, diga isso e pare para eu decidir.

## 2. Revisar o diff

`git status` e `git diff`. Confirme que:

- Nenhum segredo, credencial ou dado pessoal real entrou no diff
- `.env.local` não está sendo versionado
- Mudança em `src/lib/data/**` veio acompanhada de teste
- Coluna nova na planilha foi refletida em `docs/data-contract.md`

## 3. Commitar

Agrupe por unidade lógica, não por arquivo: uma mudança coerente que toca
componente, tipo e teste é **um** commit. Se o diff contém duas mudanças
independentes, faça dois commits.

Mensagem no imperativo e em português, dizendo o efeito e não o arquivo:
`adiciona filtro por período no funil`, não `atualiza page.tsx`.

## 4. Parar

Mostre `git log --oneline` do que foi criado e **pergunte antes de dar push**.
