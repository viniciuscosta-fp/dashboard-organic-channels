# Dashboard de Canais Orgânicos

Funil de MQLs, oportunidades e clientes por canal de origem. Os dados vêm do
HubSpot, passam por um flow do n8n e chegam ao dashboard através de uma planilha
do Google.

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
FUNNEL_SHEET_RANGE=funil!A:E
```

A planilha precisa seguir [`docs/data-contract.md`](docs/data-contract.md) —
o mesmo contrato que o flow do n8n escreve.

Confirme com `curl http://localhost:3000/api/health`: o campo `source` diz qual
fonte está ativa.

## Documentação

| Documento                                        | Assunto                                            |
| ------------------------------------------------ | -------------------------------------------------- |
| [`docs/architecture.md`](docs/architecture.md)   | Como os dados atravessam o sistema e por quê       |
| [`docs/data-contract.md`](docs/data-contract.md) | Colunas da planilha — contrato com o n8n           |
| [`docs/decisions/`](docs/decisions/)             | Decisões de arquitetura e quando revisá-las        |
| [`CLAUDE.md`](CLAUDE.md)                         | Convenções do projeto, carregadas pelo Claude Code |

## Deploy

Vercel, a partir de `main`. As variáveis de ambiente de produção são as mesmas
do `.env.example`, com `DATA_SOURCE=sheets`.

O acesso é restrito por Deployment Protection da Vercel — não há autenticação no
código. Ver [`docs/decisions/0002`](docs/decisions/0002-sem-auth-no-codigo-v1.md).
