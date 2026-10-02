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

| Camada       | Arquivos                                                                                       | Regra                                           |
| ------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Contrato     | `funnel-repository.ts`, `goal-repository.ts`, `types.ts`                                       | Sem I/O, sem dependência de fornecedor          |
| Parsing      | `sheets-parser.ts`, `goals-parser.ts`, `sheet-table.ts`                                        | Função pura, testável sem rede                  |
| Acesso       | `sheets-*-repository.ts`, `mock-*-repository.ts`                                               | Autenticação e rede; sem cache                  |
| Serviço      | `funnel-service.ts`                                                                            | Factories e cache; único ponto de entrada da UI |
| Inteligência | `goal-math.ts`, `funnel-efficiency.ts`, `period-comparison.ts`, `ratio.ts`, `business-days.ts` | Funções puras; recebem `hoje` como argumento    |
| Visualização | `funnel-view.ts`, `format.ts`, `series-colors.ts`                                              | Funções puras que preparam dados para tela      |
| URL          | `period.ts`, `dashboard-params.ts`                                                             | Traduzem `searchParams` em estado, e de volta   |
| Apresentação | `src/components/**`                                                                            | Recebe props prontas; nunca busca dado          |

`ratio.ts` é folha de propósito — sem nenhum import — para ser usado tanto pela
inteligência quanto pela visualização sem inverter a ordem das camadas. É a
única casa da política "denominador zero é `null`, nunca zero".

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
  atravessando o início do período — por isso `dataRangeFor` recua 21 dias
  corridos além do recorte. A rota busca ainda mais que isso, por causa da
  comparação com o período anterior; ver a seção adiante.
- **Confiança.** Sem histórico, não projeta. Com pouco do período decorrido,
  projeta com aviso. Período fechado mostra o resultado final.

O `AdherenceReport` sai pronto para a tela: totais, por canal, e a curva de
burn-up com realizado, meta acumulada e continuação estimada.

## Razões do funil

`funnel-efficiency.ts` compara cada razão de um canal com a razão que a meta
pressupõe. São duas naturezas com a mesma matemática — **conversão** entre etapas
e **valor** por unidade (ticket médio, receita por MQL) —, e um caminho de código
só serve as duas: é o que garante que elas nunca divirjam de política de nulo, de
janela de rateio ou de tratamento de meta ausente. `buildConversionWeeks` quebra
só as conversões em semanas completas.

O detalhe importante é o que essas razões **não** são: com dado de evento por dia
e sem vínculo entre um MQL e a oportunidade que ele virou, o que existe é razão
entre dois fluxos na mesma janela, não conversão de coorte. As consequências
disso estão em
[`decisions/0005`](decisions/0005-razoes-de-fluxo-e-conversao-implicita.md).

As razões de valor só são legítimas porque a receita de um dia pertence aos
clientes contados naquele dia — ver
[`decisions/0007`](decisions/0007-receita-pertence-aos-clientes-do-dia.md). Daí
sai também a identidade `receita por MQL = ticket médio × conversão de MQL para
cliente`, que separa contrato menor de conversão pior.

As semanas se completam com dias anteriores ao período usando o histórico que
`dataRangeFor` já busca para a janela de tendência — sem segunda ida à fonte e
sem chave de cache nova.

## Comparação com o período anterior

`period-comparison.ts` compara a janela **realizada** do recorte com os mesmos
dias úteis imediatamente anteriores. Realizada, e não o recorte inteiro: num mês
com 8 de 21 dias úteis decorridos, comparar contra 21 dias faria todo canal
aparecer despencando, todo começo de mês.

O intervalo buscado é estendido por `dataRangeWithComparisonFor`, que é
determinístico — depende só do recorte e de hoje, nunca do dado. É o que mantém
uma chave de cache e uma ida à fonte. Um teste de invariância garante que o
intervalo mais largo não altera nenhum número do `AdherenceReport`.

Sem histórico anterior suficiente, a comparação é recusada com motivo visível na
régua, em vez de calculada contra zeros. Ver
[`decisions/0008`](decisions/0008-comparacao-com-o-periodo-anterior.md).

## Foco em um canal

`?canal=` põe um canal em foco. O foco **escopa os agregados** — os quatro
cartões, a curva acumulada e o funil — e **não escopa as comparações**: as
tabelas por canal e o gráfico de evolução seguem completos, com o canal em
destaque. Filtrar uma tabela de comparação para uma linha só destrói o que a
torna útil.

Duas consequências que não podem regredir, ambas em
[`decisions/0006`](decisions/0006-foco-em-um-canal.md): a curva de burn-up sai do
**mesmo** `ChannelAdherence` que alimenta os cartões, para não haver dois ritmos
na mesma tela; e o filtro é aplicado com `applyFunnelQuery` **depois** da busca,
nunca no argumento de `getFunnelSnapshots`, que fragmentaria a chave de cache por
canal.

Como o escopo muda o significado de metade da tela, todo card nomeia o próprio
escopo no `hint`, e `ScopeNotice` diz em uma frase o que mudou e o que não mudou.

## Muitos canais e grupos

O dashboard é desenhado para até 15 canais, organizados em **grupos** (a coluna
opcional `group` da aba `canais`). Três peças sustentam isso, todas puras e
calculadas uma vez em `page.tsx`:

- **Ordem canônica.** `resolveChannels` junta os canais de um grupo na posição do
  primeiro deles pela `order`. É a ordem de seletor, painéis e tabelas de
  conversão e valor, e a base de `groupSections`, que divide a tela em seções
- **Cor por canal.** `channelColors` dá um slot de `--series-1..5` por canal,
  na ordem canônica, e cinza do sexto em diante — nunca recicla. Calculada sobre
  o catálogo inteiro, então escolher um grupo não repinta ninguém. O nome, sempre
  ao lado, é o que identifica o canal
- **Urgência.** `sortByUrgency` ordena a tabela de aderência pelo pior status de
  cada canal, e `summarizeChannelStatus` alimenta o bloco "Situação dos canais",
  que responde "quem está em risco" sem rolar quarenta linhas

A evolução por canal é _small multiples_ — um painel por canal, com escala
própria — e não um gráfico com uma linha por canal. Ver
[`decisions/0009`](decisions/0009-mais-canais-e-grupos.md).

### Seleção por grupo

Além de um canal, dá para selecionar um **grupo**: os da planilha aparecem
prontos, e outros podem ser criados na tela. `channel-groups.ts` reconcilia os
dois contra o catálogo (`selectableGroups`) e valida a criação
(`addCustomGroup`).

Grupo personalizado mora **na URL** (`?grupos=nome~canal,canal|…`), não num
banco: o link é a persistência. O formulário de criação é `GET` para
`/grupos`, um route handler que devolve um 303 para o dashboard com o grupo
gravado e selecionado — sem JavaScript, como o resto dos controles.

Com grupo selecionado, `computeAdherence` recebe `focusChannels` e devolve em
`scope` a soma dos canais do grupo contra a soma das metas deles; a curva sai do
mesmo objeto. `total` e `byChannel` seguem completos. Os blocos de comparação
mostram só o grupo — diferente do canal único, que os deixa completos. Ver
[`decisions/0010`](decisions/0010-selecao-por-grupo.md).

Nada disso toca a camada de cálculo nem o cache: `computeAdherence` e as demais
funções já tratavam canais como lista de tamanho livre.

## Estado na URL

São cinco eixos independentes: período (`?periodo=` ou `?de=&ate=`), métrica do
burn-up (`?metrica=`), transição do funil (`?taxa=`), seleção — canal em foco
(`?canal=`) ou grupo (`?grupo=`), nunca os dois — e grupos personalizados
(`?grupos=`).
`parsePeriod` é a autoridade sobre o primeiro; `parseDashboardParams` compõe
todos.

Cada controle governa um eixo e recebe `baseQuery` com os demais, montado por
`dashboardSearchParams`. É isso que impede um controle de resetar em silêncio a
escolha feita em outro — a regressão mais fácil de introduzir aqui e mais difícil
de notar.

O canal é validado em dois tempos: `parseDashboardParams` devolve a chave crua, e
`resolveChannelParam` a reconcilia contra o catálogo na rota, porque a lista de
canais válidos vem do dado, que só é buscado depois.

Entrada inválida cai no padrão em vez de derrubar a página — um link colado
errado não pode quebrar o dashboard de quem abriu.

Nenhum controle usa JavaScript: presets e abas são links, e o intervalo
personalizado é um formulário `GET`. Todo estado fica compartilhável por URL.

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

- Decomposição do gap em volume contra eficiência de conversão
- Rota de revalidação sob demanda para o n8n chamar após escrever
- Feriados nacionais na contagem de dias úteis
- Fontes de GA4, GSC e Semrush
- Autenticação no código — a proteção depende de onde o dashboard for hospedado,
  decisão ainda em aberto; ver
  [`decisions/0002`](decisions/0002-sem-auth-no-codigo-v1.md)
