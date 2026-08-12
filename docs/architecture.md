# Arquitetura

## O caminho do dado

```
HubSpot → webhook n8n → Apps Script (coleta diária) → aba `funil` ─┐
                                                                   │
                        time comercial ──────────────→ aba `metas` ─┼→ repositórios
                                                                   │   (sheets ou mock)
                        marketing ──────────────────→ aba `canais` ─┘        │
                                                                             │ use cache
                                                                             ↓
                                                                     computeAdherence()
                                                                             ↓
                                                                        app/page.tsx
                                                                             ↓
                                                                        componentes
```

A coleta escreve; o dashboard lê. Não há caminho de escrita no app — nenhuma
rota recebe dados. Isso mantém a superfície de ataque mínima e dispensa
autenticação de máquina para máquina.

O webhook devolve os números agregados de um canal num intervalo. Para ter série
diária, o Apps Script chama uma vez por dia e canal, gravando por upsert. O
script vive em `scripts/apps-script/coleta-diaria.js` e o roteiro de instalação
em [`setup-planilha-e-apps-script.md`](setup-planilha-e-apps-script.md).

## A decisão central: a UI não conhece a fonte

`FunnelRepository` é a única forma de ler o funil:

```ts
interface FunnelRepository {
  readonly source: FunnelDataSource
  getSnapshots(query?: FunnelQuery): Promise<FunnelSnapshot[]>
}
```

A V1 usa uma planilha porque o volume é pequeno e o custo é zero. Quando GA4,
GSC e Semrush entrarem — trazendo as etapas anteriores do funil — a planilha
deixa de servir, e a migração para Postgres será escrever
`PostgresFunnelRepository`. **Nenhum componente muda.**

Isso não é uma promessa de boa vontade: `tests/architecture.test.ts` falha se
algum arquivo em `src/components/**` importar `google-auth-library`, os módulos
de Sheets ou `lib/env`.

`MockFunnelRepository` é o padrão em desenvolvimento. É o que faz `npm run dev`
funcionar logo após o clone, sem credencial nenhuma, e o que permite testar a UI
sem rede.

## Camadas

| Camada       | Arquivos                                                 | Regra                                           |
| ------------ | -------------------------------------------------------- | ----------------------------------------------- |
| Contrato     | `funnel-repository.ts`, `goal-repository.ts`, `types.ts` | Sem I/O, sem dependência de fornecedor          |
| Parsing      | `sheets-parser.ts`, `goals-parser.ts`, `sheet-table.ts`  | Função pura, testável sem rede                  |
| Acesso       | `sheets-*-repository.ts`, `mock-*-repository.ts`         | Autenticação e rede; sem cache                  |
| Serviço      | `funnel-service.ts`                                      | Factories e cache; único ponto de entrada da UI |
| Inteligência | `goal-math.ts`, `business-days.ts`, `period.ts`          | Funções puras; recebem `hoje` como argumento    |
| Visualização | `funnel-view.ts`, `format.ts`                            | Funções puras que preparam dados para tela      |
| Apresentação | `src/components/**`                                      | Recebe props prontas; nunca busca dado          |

A separação entre parsing e acesso existe para que a lógica que mais quebra —
interpretar o que veio de fora — seja testável sem credencial e sem rede. O
transporte é compartilhado pelas três abas em `sheets-client.ts`; só o intervalo
e o parser mudam.

### Ler valor cru, nunca formatado

`sheets-client.ts` pede `valueRenderOption=UNFORMATTED_VALUE`. Não é detalhe de
performance: o padrão da API devolve o **texto exibido**, e um inteiro com
separador de milhar voltaria como `"1.825"`, que a coerção numérica lê como
1,825. Mil vezes menos, sem erro nenhum. Ver
[`decisions/0004`](decisions/0004-receita-como-metrica-e-leitura-crua-da-planilha.md).

## Aderência à meta

A camada de inteligência é inteiramente pura, e é onde mora a parte do produto
que decide reunião. As regras e o porquê de cada escolha estão em
[`decisions/0003`](decisions/0003-base-de-dias-uteis-e-metodo-de-projecao.md);
o resumo operacional:

- **Rateio.** A meta é mensal. Para o período selecionado, cada mês contribui na
  proporção dos seus dias úteis que caem dentro do recorte.
- **Base de dias.** Segunda a sexta, sem feriados. A mesma base no rateio e na
  projeção.
- **Âncora.** O decorrido é medido contra a última data com dado, não contra o
  calendário.
- **Ritmo.** Média por dia útil nos últimos 10 dias úteis, com a janela
  atravessando o início do período — por isso a consulta busca 21 dias corridos
  a mais que o recorte (`dataRangeFor`).
- **Confiança.** Sem histórico, não projeta. Com pouco do período decorrido,
  projeta com aviso. Período fechado mostra o resultado final.

O `AdherenceReport` sai pronto para a tela: totais, por canal, e a curva de
burn-up com realizado, meta acumulada e continuação estimada.

## Período

O período vem da URL (`?periodo=` ou `?de=&ate=`) e é resolvido por
`parsePeriod`. Entrada inválida cai no preset padrão em vez de derrubar a
página — um link colado errado não pode quebrar o dashboard de quem abriu.

O seletor não usa JavaScript: presets são links e o intervalo personalizado é um
formulário `GET`. Todo período fica compartilhável por URL.

## Cache

`getFunnelSnapshots` usa `use cache` com o perfil `hours` (revalida em 1h,
expira em 1 dia) e a tag `funnel`. `getGoals` usa o perfil `days` e a tag
`goals`, porque meta é decisão mensal e não dado que flutua. Isso exige
`cacheComponents: true` em `next.config.ts`, o modelo de cache do Next 16.

A escolha vem do ritmo do dado: o n8n atualiza a planilha algumas vezes por dia,
e a API do Sheets leva perto de um segundo por leitura — cara demais para rodar
a cada renderização.

As tags `funnel` e `goals` estão declaradas esperando uma rota de revalidação
sob demanda, que permitiria ao n8n derrubar o cache logo após escrever, em vez
de esperar a janela expirar. Essa rota ainda não existe.

### A regra do relógio

**Nenhuma leitura de data do sistema pode acontecer dentro de um escopo
`use cache`.** A data ficaria congelada junto com o resto da entrada, e no dia
seguinte a projeção estaria calculando contra um "hoje" velho.

`todayInBusinessTimezone()` é chamada em `page.tsx`, depois de `connection()`,
que marca o limite do prerender. A data desce como argumento para as funções
puras. Pelo mesmo motivo, o mock não lê relógio: ele gera dados para o intervalo
pedido, e quem decide não pedir data futura é a rota, via `dataRangeFor`.

O fuso é `America/Sao_Paulo`, não UTC: das 21h em diante o dia UTC já virou, e o
dashboard passaria a contar um dia útil que ainda não aconteceu.

### Prerender parcial

Com a leitura de `searchParams` e do relógio, a rota `/` passou a aparecer como
**Partial Prerender** no `npm run build`: a casca (cabeçalho, layout) é estática
e o conteúdo é transmitido em tempo de request, dentro do `<Suspense>` que já
existia. Isso é o desenho pretendido, não uma regressão — e resolve o tradeoff
anterior, em que um build com credencial quebrada congelava o estado de erro no
shell estático.

## Ambiente

`src/lib/env.ts` valida com Zod na primeira leitura e falha com mensagem
explícita. As variáveis do Google são opcionais no schema e obrigatórias via
`superRefine` só quando `DATA_SOURCE=sheets` — assim o modo mock não exige nada.

A validação é uma função, e não uma constante exportada, para rodar em tempo de
request e não durante o build.

## O que ainda não existe

- Filtro por canal na interface (`FunnelQuery` já suporta; falta UI)
- Rota de revalidação sob demanda para o n8n chamar após escrever
- Feriados nacionais na contagem de dias úteis
- Fontes de GA4, GSC e Semrush
- Autenticação no código — hoje a proteção é da Vercel
