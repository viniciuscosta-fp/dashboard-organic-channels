# Dashboard de Canais Orgânicos

Aderência à meta de receita, MQLs, oportunidades e clientes por canal de origem.
Os dados vêm do HubSpot, passam por um webhook do n8n e chegam ao dashboard
através de uma planilha do Google.

Além dos números realizados, o dashboard mostra a meta rateada para o período
selecionado, o gap contra o ritmo esperado e onde o período fecha mantendo a
tendência recente do canal.

## Estado

_Atualizado em 13 de agosto de 2026._

Funcional de ponta a ponta com dado real:

- A coleta diária alimenta a planilha e o histórico cobre **fevereiro a agosto
  de 2026**
- As metas de **agosto de 2026** estão preenchidas para os cinco canais nas
  quatro métricas
- `npm run verify` verde

**Único item em aberto: hospedagem.** A Vercel foi descartada por restrições de
compliance e nenhuma alternativa foi escolhida, então o dashboard roda apenas
localmente. Como não há autenticação no código, proteção de acesso e hospedagem
são a mesma decisão — ver
[`docs/decisions/0002`](docs/decisions/0002-sem-auth-no-codigo-v1.md).

Mantenha esta seção honesta: ela é o que uma pessoa (ou um agente) lê primeiro
para saber o que já está pronto.

## Rodando localmente

Requer Node 20.9 ou superior (`.nvmrc` fixa a 22).

```bash
git clone git@github.com:viniciuscosta-fp/dashboard-organic-channels.git
cd dashboard-organic-channels
npm install
cp .env.example .env.local
npm run dev
```

Abre em `http://localhost:3000` com dados de exemplo. **Nenhuma credencial é
necessária para desenvolver** — `DATA_SOURCE=mock` é o padrão.

## Scripts

| Script               | O que faz                                                                |
| -------------------- | ------------------------------------------------------------------------ |
| `npm run dev`        | Servidor de desenvolvimento                                              |
| `npm run verify`     | Formatação, lint, typecheck, testes e build — o portão antes de commitar |
| `npm run test`       | Vitest, uma passada                                                      |
| `npm run test:watch` | Vitest em watch                                                          |
| `npm run format`     | Prettier em tudo                                                         |

## Conectando à planilha real

1. Crie uma service account no Google Cloud e habilite a **Google Sheets API**.
2. Gere uma chave JSON para essa conta.
3. Compartilhe a planilha do funil com o e-mail da service account, como
   **Leitor**.
4. Preencha `.env.local`:

```dotenv
DATA_SOURCE=sheets
GOOGLE_SERVICE_ACCOUNT_EMAIL=...@....iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FUNNEL_SHEET_ID=<trecho entre /d/ e /edit na URL>
FUNNEL_SHEET_RANGE=funil!A:F
GOALS_SHEET_RANGE=metas!A:D
CHANNELS_SHEET_RANGE=canais!A:C
```

A planilha precisa de **três abas** — `funil`, `metas` e `canais` — no formato de
[`docs/data-contract.md`](docs/data-contract.md).

O passo a passo completo, da planilha vazia até a coleta diária rodando
sozinha, está em
[`docs/setup-planilha-e-apps-script.md`](docs/setup-planilha-e-apps-script.md).

Confirme com `curl http://localhost:3000/api/health`: o campo `source` diz qual
fonte está ativa.

## Documentação

| Documento                                                                      | Assunto                                            |
| ------------------------------------------------------------------------------ | -------------------------------------------------- |
| [`docs/setup-planilha-e-apps-script.md`](docs/setup-planilha-e-apps-script.md) | Da planilha vazia à coleta diária rodando          |
| [`docs/architecture.md`](docs/architecture.md)                                 | Como os dados atravessam o sistema e por quê       |
| [`docs/data-contract.md`](docs/data-contract.md)                               | Colunas das três abas — contrato com a coleta      |
| [`docs/decisions/`](docs/decisions/)                                           | Decisões de arquitetura e quando revisá-las        |
| [`CLAUDE.md`](CLAUDE.md)                                                       | Convenções do projeto, carregadas pelo Claude Code |

## Hospedagem

**Ainda não definida.** A Vercel foi descartada por restrições de compliance da
empresa, e nenhuma alternativa foi escolhida. Hoje o dashboard roda localmente.

Como não há autenticação no código, a proteção de acesso é responsabilidade de
onde ele for hospedado — o que precisa ser resolvido junto com a escolha. Ver
[`docs/decisions/0002`](docs/decisions/0002-sem-auth-no-codigo-v1.md).

Quando houver destino, as variáveis de produção são as do `.env.example`, com
`DATA_SOURCE=sheets`.
