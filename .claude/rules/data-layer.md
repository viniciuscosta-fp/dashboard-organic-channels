---
paths:
  - 'src/lib/data/**'
  - 'src/lib/env.ts'
---

# Camada de dados

## A regra que não se quebra

A UI nunca conhece a fonte. Nada em `src/components/**` importa
`google-auth-library`, `sheets-*` ou `lib/env`. `tests/architecture.test.ts`
garante isso — se você precisar afrouxar esse teste, a mudança está errada.

Toda leitura passa por `getFunnelSnapshots` em `funnel-service.ts`.

## Adicionar uma nova fonte (GA4, GSC, Semrush, Postgres)

1. Implemente `FunnelRepository` (`funnel-repository.ts`) num arquivo novo.
2. Acrescente o identificador em `FunnelDataSource` e no enum `DATA_SOURCE` de
   `src/lib/env.ts`, com as variáveis exigidas no `superRefine`.
3. Registre a implementação na factory `getFunnelRepository`, com `import()`
   dinâmico — o caminho `mock` não pode carregar cliente de fornecedor nenhum.
4. Separe parsing puro do cliente HTTP, como em `sheets-parser.ts` versus
   `sheets-funnel-repository.ts`, e teste o parser sem rede.
5. Reaproveite `applyFunnelQuery` se a fonte não souber filtrar sozinha.

## Cache

`use cache` + `cacheLife` vivem só em `funnel-service.ts`. Repositório sempre
bate na fonte; quem decide validade é a camada de serviço. Ao mudar o perfil de
cache, confira a coluna `Revalidate` na saída de `npm run build`.

## Erros

Falha de fonte é `FunnelDataError` com mensagem acionável em português —
qual variável conferir, qual permissão falta. Nunca "algo deu errado".

## LGPD

Só entram aqui números agregados. Se alguma coluna nova puder identificar uma
pessoa (nome, e-mail, telefone, empresa de um lead único), pare e registre a
decisão em `docs/decisions/` antes de escrever o código.
