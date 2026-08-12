# CLAUDE.md

Dashboard do funil de canais orgânicos da Fluencypass. Responde uma pergunta:
quantos MQLs, oportunidades e clientes cada canal gerou, e como isso evolui.

Escreva código, comentários, mensagens de commit e texto de interface em
**português brasileiro**. Identificadores em inglês.

## Comandos

```bash
npm install
cp .env.example .env.local   # DATA_SOURCE=mock já basta para desenvolver
npm run dev                  # http://localhost:3000

npm run verify               # format + lint + typecheck + test + build
npm run test:watch           # Vitest em watch
```

`npm run verify` é o portão. Nada é dado por pronto sem ele verde.

## Stack

Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind v4,
Recharts, Zod, Vitest. Gerenciador: **npm** — não troque para pnpm ou yarn.

Next 16 tem quebras em relação a versões anteriores. A documentação da versão
instalada está em `node_modules/next/dist/docs/` — consulte antes de usar API
de cache, roteamento ou renderização de memória.

## Arquitetura

```
n8n → Google Sheets → SheetsFunnelRepository ─┐
                                              ├→ getFunnelSnapshots() → page.tsx → componentes
                      MockFunnelRepository ───┘        (use cache)
```

| Caminho                             | Papel                                                    |
| ----------------------------------- | -------------------------------------------------------- |
| `src/lib/data/funnel-repository.ts` | Interface `FunnelRepository` e `FunnelDataError`         |
| `src/lib/data/funnel-service.ts`    | Factory, cache (`use cache`), entrada da UI              |
| `src/lib/data/*-parser.ts`          | Parsing puro de fonte externa, sem rede                  |
| `src/lib/data/funnel-view.ts`       | Modelos de visualização, funções puras                   |
| `src/lib/env.ts`                    | Validação de ambiente com Zod, falha alto                |
| `src/components/`                   | Atomic Design: atoms → molecules → organisms → templates |
| `src/app/page.tsx`                  | Único lugar que busca dados                              |

### Regras que não se quebram

1. **A UI não conhece a fonte.** Nada em `src/components/**` importa
   `google-auth-library`, `sheets-*` ou `lib/env`. Verificado por
   `tests/architecture.test.ts`.
2. **Busca de dados fica na rota**, não dentro de componente. Componente recebe
   props prontas.
3. **Cache mora só em `funnel-service.ts`.** Repositório sempre bate na fonte.
4. **Só dados agregados.** Nenhum campo que identifique uma pessoa entra no
   modelo, no mock, no teste ou na planilha. Se um pedido exigir isso, pare e
   peça decisão humana.
5. **Server Component por padrão.** `'use client'` apenas para os gráficos.

Para adicionar uma fonte nova, use a skill `funnel-repository-contract` ou o
agente `funnel-source-agent`.

## Dados

`docs/data-contract.md` é o contrato entre o flow do n8n e o código: nome,
ordem e formato das colunas. Mudou coluna na planilha? O doc muda no mesmo
commit que o parser.

Colunas: `date`, `channel`, `mqls`, `opportunities`, `customers`. Mapeadas por
nome, nunca por posição.

## Cores e gráficos

Nunca escreva hex em componente — use os tokens de `src/app/globals.css`.
`--series-1..3` identificam canais; `--stage-1..3`, etapas do funil.

Os hexes foram validados para daltonismo e contraste nos modos claro e escuro.
Trocar um exige revalidar a paleta inteira. Todo gráfico leva tooltip; duas ou
mais séries exigem legenda; eixo duplo é proibido.

## Testes

Unitário ao lado do código; teste de projeto em `tests/`. Cobrimos função pura,
parser (incluindo erros) e a fronteira de arquitetura. Não cobrimos componente
que só repassa props.

Nunca afrouxe um teste ou adicione `eslint-disable` para fazer a verificação
passar. Se a regra parecer errada, diga isso e pare.

## Git

Commits agrupam **unidade lógica**, não arquivo: uma mudança que toca
componente, tipo e teste é um commit só. Mensagem no imperativo, em português,
dizendo o efeito — `adiciona filtro por período no funil`, não
`atualiza page.tsx`.

PRs pequenos e focados, squash merge. `main` é a branch de trabalho hoje;
sempre confirme antes de dar push.

## Segredos

`.env.local` e `.env` estão bloqueados para leitura em `.claude/settings.json`
de propósito. Nenhuma credencial, CPF, e-mail ou telefone real entra no
repositório — nem em teste, nem em mock, nem em exemplo de documentação.

## Comandos do projeto

| Comando        | Quando                                                  |
| -------------- | ------------------------------------------------------- |
| `/spec <slug>` | Feature nova — escreve a spec antes de qualquer código  |
| `/ship`        | Fechar trabalho: verifica, revisa diff, prepara commits |
| `/data-check`  | Dashboard com erro ou número estranho                   |

@AGENTS.md
