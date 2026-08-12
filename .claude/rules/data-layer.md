---
paths:
  - 'src/lib/data/**'
  - 'src/lib/env.ts'
  - 'src/lib/business-days.ts'
  - 'src/lib/period.ts'
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

## Cache e relógio

`use cache` + `cacheLife` vivem só em `funnel-service.ts`. Repositório sempre
bate na fonte; quem decide validade é a camada de serviço. Ao mudar o perfil de
cache, confira a coluna `Revalidate` na saída de `npm run build`.

**Nunca leia data do sistema aqui.** `new Date()`, `Date.now()` e afins dentro
de um escopo cacheado congelam junto com o cache. A data de hoje entra como
argumento, vinda de `page.tsx` depois de `connection()`. Vale para o mock
também: ele gera dados para o intervalo pedido e não sabe que dia é hoje.

## Matemática de meta

`goal-math.ts` é puro e é onde ficam as constantes de janela, limiar e
confiança. Ajuste os números lá, nunca espalhados pela lógica. Todo caso novo
precisa de teste antes da implementação — a regressão silenciosa aqui aparece
numa reunião de resultado, não num erro de runtime.

Rateio e projeção usam a **mesma** base de dias úteis. Se você mudar uma,
mude a outra, ou os números da tela passam a discordar entre si.

## Erros

Falha de fonte é `FunnelDataError` com mensagem acionável em português —
qual variável conferir, qual permissão falta. Nunca "algo deu errado".

## LGPD

Só entram aqui números agregados. Se alguma coluna nova puder identificar uma
pessoa (nome, e-mail, telefone, empresa de um lead único), pare e registre a
decisão em `docs/decisions/` antes de escrever o código.
