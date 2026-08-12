# Arquitetura

## O caminho do dado

```
HubSpot  →  flow n8n  →  Google Sheets  →  SheetsFunnelRepository ─┐
                                                                   ├→ getFunnelSnapshots()
                                            MockFunnelRepository ──┘        │ use cache
                                                                            ↓
                                                                    app/page.tsx
                                                                            ↓
                                                                     componentes
```

O n8n escreve; o dashboard lê. Não há caminho de escrita no app — nenhuma rota
recebe dados. Isso mantém a superfície de ataque mínima e dispensa autenticação
de máquina para máquina.

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

| Camada       | Arquivos                                                   | Regra                                         |
| ------------ | ---------------------------------------------------------- | --------------------------------------------- |
| Contrato     | `funnel-repository.ts`, `types.ts`                         | Sem I/O, sem dependência de fornecedor        |
| Parsing      | `sheets-parser.ts`                                         | Função pura, testável sem rede                |
| Acesso       | `sheets-funnel-repository.ts`, `mock-funnel-repository.ts` | Autenticação e rede; sem cache                |
| Serviço      | `funnel-service.ts`                                        | Factory e cache; único ponto de entrada da UI |
| Visualização | `funnel-view.ts`, `format.ts`                              | Funções puras que preparam dados para tela    |
| Apresentação | `src/components/**`                                        | Recebe props prontas; nunca busca dado        |

A separação entre parsing e acesso existe para que a lógica que mais quebra —
interpretar o que veio de fora — seja testável sem credencial e sem rede.

## Cache

`getFunnelSnapshots` usa `use cache` com o perfil `hours` (revalida em 1h,
expira em 1 dia) e a tag `funnel`. Isso exige `cacheComponents: true` em
`next.config.ts`, que é o modelo de cache do Next 16.

A escolha vem do ritmo do dado: o n8n atualiza a planilha algumas vezes por dia,
e a API do Sheets leva perto de um segundo por leitura — cara demais para rodar
a cada renderização.

Para conferir o efeito, olhe a coluna `Revalidate` na saída de `npm run build`:
a rota `/` deve aparecer com a janela do perfil escolhido.

A tag `funnel` está declarada esperando uma rota de revalidação sob demanda, que
permitiria ao n8n derrubar o cache logo após escrever, em vez de esperar a
janela expirar. Essa rota ainda não existe.

### Tradeoff conhecido

A página é prerenderizada no build. Se as credenciais estiverem quebradas no
momento do build, o shell estático sai com o estado de erro, e ele fica no ar
até a primeira revalidação. Falha de leitura **não** é cacheada — recarregar
tenta de novo — mas o shell prerenderizado, sim. É aceitável para um dashboard
interno de baixo tráfego; deixa de ser se o dashboard virar crítico.

## Ambiente

`src/lib/env.ts` valida com Zod na primeira leitura e falha com mensagem
explícita. As variáveis do Google são opcionais no schema e obrigatórias via
`superRefine` só quando `DATA_SOURCE=sheets` — assim o modo mock não exige nada.

A validação é uma função, e não uma constante exportada, para rodar em tempo de
request e não durante o build.

## O que ainda não existe

- Filtro de período e de canal na interface (`FunnelQuery` já suporta; falta UI)
- Rota de revalidação sob demanda para o n8n chamar
- Fontes de GA4, GSC e Semrush
- Autenticação no código — hoje a proteção é da Vercel
