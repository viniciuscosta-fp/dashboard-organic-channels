# Dashboard de Canais Orgânicos

Aderência à meta de receita, MQLs, oportunidades e clientes por canal de origem.
Os dados vêm do HubSpot, passam por um webhook do n8n e chegam ao dashboard
através de uma planilha do Google.

Além dos números realizados, o dashboard mostra a meta rateada para o período
selecionado, o gap contra o ritmo esperado e onde o período fecha mantendo a
tendência recente do canal. Mostra também **como cada canal converte entre as
etapas do funil**, semana a semana, contra a conversão que a meta pressupõe.

## Estado

_Atualizado em 13 de agosto de 2026._

Funcional de ponta a ponta com dado real:

- A coleta diária alimenta a planilha e o histórico cobre **fevereiro a agosto
  de 2026**
- As metas de **agosto de 2026** estão preenchidas para os cinco canais nas
  quatro métricas
- `npm run verify` verde

**V2, fatia 1 — taxas de conversão (entregue).** Card "Taxas de conversão" com
uma linha por canal e uma coluna por semana, abas para as três transições
(MQL → Oportunidade, Oportunidade → Cliente, MQL → Cliente), a conversão
implícita na meta como referência e a variação em pontos percentuais contra a
semana anterior. O gráfico de etapas passou a exibir a razão entre etapas, que
já era calculada e descartada. Nada disso mudou a planilha, o intervalo buscado
ou a chave de cache — é derivação sobre os dados que já existiam. As premissas e
os limites do que essas razões medem estão em
[`docs/decisions/0005`](docs/decisions/0005-razoes-de-fluxo-e-conversao-implicita.md);
o principal é que são **razões de fluxo, não conversão de coorte**.

**V2, fatia 2 — foco em um canal (entregue).** Pílulas de canal ao lado do
seletor de período. Com um canal em foco, os quatro cartões, a curva acumulada e
o funil passam a ser dele; as tabelas por canal e o gráfico de evolução seguem
completos, com o canal em destaque, porque é comparando que a escolha faz
sentido. Cada card diz de quem são os números que mostra. Ver
[`docs/decisions/0006`](docs/decisions/0006-foco-em-um-canal.md).

**V2, fatia 3 — valor por canal (entregue).** Card com ticket médio e receita por
MQL de cada canal, contra o que a meta pressupõe. Só foi possível depois de
confirmado que a receita de um dia pertence aos clientes fechados naquele dia —
o contrato de dados agora diz isso, e a
[`decisão 0007`](docs/decisions/0007-receita-pertence-aos-clientes-do-dia.md)
registra o que essa garantia autoriza e o que continua fora de alcance. Sem
colunas de semana: um canal fecha poucos clientes por semana, e a média semanal
seria um contrato único disfarçado de média.

**V2, fatia 4 — comparação com o período anterior (entregue).** Cada um dos
quatro números do topo e cada linha da tabela por canal ganharam a variação
contra a janela equivalente anterior. Equivalente quer dizer os mesmos dias úteis
**realizados**: num mês com 8 de 21 dias decorridos, a comparação é contra os 8
dias úteis anteriores, não contra o mês inteiro — senão todo canal apareceria
despencando todo começo de mês. Sem histórico anterior suficiente, a comparação é
recusada com aviso na régua em vez de calculada contra zeros. Ver
[`docs/decisions/0008`](docs/decisions/0008-comparacao-com-o-periodo-anterior.md).

Próxima fatia, ainda não começada: decomposição do gap em volume contra
eficiência de conversão.

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
CHANNELS_SHEET_RANGE=canais!A:D
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
