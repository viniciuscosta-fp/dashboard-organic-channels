# CLAUDE.md

Dashboard de aderência à meta dos canais orgânicos da Fluencypass. Responde
duas perguntas: quanto cada canal entregou de MQL, oportunidade e cliente, e
onde o período vai fechar mantendo o ritmo atual.

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
n8n → Sheets (abas funil e metas) → repositórios ─→ getFunnelSnapshots() ─┐
                                    mocks ─────────→ getGoals()           ├→ computeAdherence()
                                                        (use cache)       │        ↓
                                                                          └→ page.tsx → componentes
```

| Caminho                          | Papel                                                    |
| -------------------------------- | -------------------------------------------------------- |
| `src/lib/data/*-repository.ts`   | Contratos de leitura: funil, metas e canais              |
| `src/lib/data/funnel-service.ts` | Factories, cache (`use cache`), entrada da UI            |
| `src/lib/data/*-parser.ts`       | Parsing puro de fonte externa, sem rede                  |
| `src/lib/data/sheets-client.ts`  | Autenticação e transporte, comum às três abas            |
| `src/lib/data/goal-math.ts`      | Rateio, gap, ritmo, projeção, status, burn-up            |
| `src/lib/business-days.ts`       | Aritmética de dias úteis                                 |
| `src/lib/period.ts`              | Presets de período e leitura da URL                      |
| `src/lib/data/funnel-view.ts`    | Modelos de visualização, funções puras                   |
| `src/lib/env.ts`                 | Validação de ambiente com Zod, falha alto                |
| `src/components/`                | Atomic Design: atoms → molecules → organisms → templates |
| `src/app/page.tsx`               | Único lugar que busca dados e lê relógio                 |

### Regras que não se quebram

1. **A UI não conhece a fonte.** Nada em `src/components/**` importa
   `google-auth-library`, `sheets-*` ou `lib/env`. Verificado por
   `tests/architecture.test.ts`.
2. **Busca de dados fica na rota**, não dentro de componente. Componente recebe
   props prontas.
3. **Cache mora só em `funnel-service.ts`.** Repositório sempre bate na fonte.
4. **Nada de relógio dentro de `use cache`.** `new Date()` num escopo cacheado
   congela junto com o cache e a projeção erra. A data de hoje é lida em
   `page.tsx`, depois de `connection()`, e desce como argumento.
5. **Só dados agregados.** Nenhum campo que identifique uma pessoa entra no
   modelo, no mock, no teste ou na planilha. Se um pedido exigir isso, pare e
   peça decisão humana.
6. **Server Component por padrão.** `'use client'` apenas para os gráficos.

Para adicionar uma fonte nova, use a skill `funnel-repository-contract` ou o
agente `funnel-source-agent`.

## Aderência à meta

Meta é cadastrada por **mês** e rateada para o período selecionado
proporcionalmente aos **dias úteis** de cada mês. A mesma base de dias vale
para o rateio e para a projeção — misturar as duas faz os números brigarem.

Projeção é `realizado + ritmo dos últimos 10 dias úteis × dias úteis
restantes`. A janela atravessa o início do período de propósito, senão a
primeira quinzena de todo mês ficaria sem projeção.

O decorrido é medido contra a **última data com dado**, não contra o
calendário: flow atrasado não pode virar atraso de meta.

Limiares e janelas são constantes nomeadas no topo de `goal-math.ts`. Ajuste
ali, nunca espalhado pela lógica. O porquê de cada escolha está em
`docs/decisions/0003`.

## Dados

`docs/data-contract.md` é o contrato entre a coleta e o código. Mudou coluna na
planilha? O doc muda no mesmo commit que o parser.

Três abas, todas com colunas mapeadas por nome e nunca por posição:

| Aba      | Uma linha por        | Colunas                                                            |
| -------- | -------------------- | ------------------------------------------------------------------ |
| `funil`  | dia e canal          | `date`, `channel`, `revenue`, `mqls`, `opportunities`, `customers` |
| `metas`  | mês, canal e métrica | `month`, `channel`, `metric`, `target`                             |
| `canais` | canal                | `channel`, `label`, `order` e, opcional, `group`                   |

Quem escreve é `scripts/apps-script/coleta-diaria.js`, que roda na planilha e
consulta o webhook de métricas por canal. Ele grava por **upsert**: dia e canal
repetidos derrubam a leitura do dashboard, porque somariam em silêncio.

**Esse arquivo não sincroniza com a planilha.** O que executa é a cópia colada
no editor do Apps Script, na conta Google. Editar aqui não muda a coleta: é
preciso avisar que a versão nova precisa ser colada lá, e que a `WEBHOOK_URL` no
topo tem de ser preenchida de novo a cada colagem — o arquivo versionado carrega
só um marcador, porque o endpoint é interno.

Duas armadilhas já resolvidas, que não devem regredir: a API do Sheets é lida
com `UNFORMATTED_VALUE` (o padrão devolveria `"1.825"` para 1825, lido como
1,825), e a coluna `date` é texto simples (como data, voltaria número serial).

A granularidade diária é requisito: sem ela não há ritmo, tendência nem
projeção.

## Métricas e etapas

`METRICS` são as quatro com meta: receita, MQLs, oportunidades e clientes.
`FUNNEL_STAGES` são só as três contagens, e existem para o gráfico de funil —
receita não é estreitamento, é valor.

Receita usa schema decimal e formatação em reais; contagens são inteiras. Use
`formatMetricValue` em vez de escolher o formatador na mão.

## Cores e gráficos

Nunca escreva hex em componente — use os tokens de `src/app/globals.css`.
`--series-1..5` identificam **grupos** de canais, sempre via `channelColors`;
`--stage-1..3`, etapas do funil. O dashboard é desenhado para até 15 canais:
cor nunca identifica canal sozinha, o nome sempre vai junto (decisão 0009). A exceção
é a paleta de status em `status-badge.tsx`, fixa e independente de tema.

Os hexes foram validados para daltonismo e contraste nos modos claro e escuro.
Trocar um exige revalidar a paleta inteira. Todo gráfico leva tooltip; duas ou
mais séries exigem legenda; eixo duplo é proibido.

Status nunca é comunicado só por cor: sempre ícone **e** rótulo. No modo claro
o amarelo de atenção fica abaixo de 3:1, e é o par que sustenta a leitura.

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
