---
name: funnel-repository-contract
description: Contrato de FunnelRepository e passo a passo para adicionar uma fonte de dados nova (GA4, GSC, Semrush, Postgres) ao dashboard. Use ao implementar, revisar ou depurar qualquer origem de dados do funil.
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Contrato de fonte de dados do funil

## Por que a interface existe

A V1 lê o funil de uma planilha alimentada pelo n8n. Quando GA4, GSC e Semrush
entrarem, a planilha deixa de dar conta. A interface garante que essa troca seja
escrever um arquivo novo — e não refatorar a UI.

A fronteira é verificada por `tests/architecture.test.ts`. Se você precisar
mudar esse teste para o seu código passar, o código está errado.

## O contrato

```ts
type FunnelDataSource = 'mock' | 'sheets'

interface FunnelRepository {
  readonly source: FunnelDataSource
  getSnapshots(query?: FunnelQuery): Promise<FunnelSnapshot[]>
}

interface GoalRepository {
  readonly source: FunnelDataSource
  getGoals(): Promise<MonthlyGoal[]>
}
```

`FunnelSnapshot` carrega apenas números agregados: `date` (ISO `AAAA-MM-DD`, **o
dia**), `channel`, `mqls`, `opportunities`, `customers`. Nada em nível de lead.

`MonthlyGoal` é a meta **mensal** de uma etapa num canal: `month` (ISO
`AAAA-MM`), `channel`, `stage`, `target`. O rateio para o período selecionado
acontece em `goal-math.ts`, nunca no repositório.

Autenticação e transporte do Google Sheets são compartilhados em
`sheets-client.ts` — não duplique o cliente JWT numa fonte nova.

`getSnapshots` devolve ordenado por data e depois por canal. Se a fonte não
souber filtrar, aplique `applyFunnelQuery` — não reimplemente o filtro.

Falha de fonte é `FunnelDataError`, com mensagem em português que diz o que
conferir. O erro carrega `source`, então a mensagem não precisa repetir isso.

## Adicionar uma fonte

1. `src/lib/data/<fonte>-parser.ts` — puro, sem cliente de fornecedor, com
   testes cobrindo cabeçalho, coerção de tipo, linha vazia e cada erro.
2. `src/lib/data/<fonte>-funnel-repository.ts` — só autenticação, rede e
   montagem; chama o parser.
3. `FunnelDataSource` ganha o novo identificador.
4. `src/lib/env.ts` ganha as variáveis, opcionais no schema e exigidas no
   `superRefine` quando `DATA_SOURCE` for a nova fonte.
5. `getFunnelRepository` ganha o ramo, com `import()` dinâmico.
6. `.env.example` ganha os nomes das variáveis com comentário — nunca valores.

## Cache

Não cacheie dentro do repositório. `getFunnelSnapshots` em `funnel-service.ts` é
o único lugar com `use cache` e `cacheLife`. Repositório sempre bate na fonte.

Para verificar o efeito, olhe a coluna `Revalidate` na saída de
`npm run build`: a rota `/` deve aparecer com a janela do perfil escolhido.

## Armadilhas

- Chave privada de service account chega com `\n` literal — passe por
  `normalizePrivateKey`.
- Google Sheets devolve toda célula como string; a coerção fica no schema Zod.
- Mapeie coluna por **nome**, nunca por posição: reordenar a planilha não pode
  trocar MQLs por clientes silenciosamente.
- `getEnv()` é validado uma vez por processo e falha alto — não capture esse
  erro para seguir com valor padrão.
