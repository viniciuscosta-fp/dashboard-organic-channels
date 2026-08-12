# 0001 — Google Sheets como armazenamento da V1

- **Status:** aceita
- **Data:** 2026-08-12

## Contexto

A V1 do dashboard mostra o funil comercial do HubSpot — MQLs, oportunidades e
clientes. Já existe um flow do n8n que extrai esses dados. Falta decidir onde
eles ficam entre o n8n e o dashboard.

O volume é pequeno: contagens agregadas por período e canal, algumas centenas de
linhas por ano. O dado muda no máximo algumas vezes por dia.

## Alternativas

**Postgres (Supabase ou Neon).** Robusto e já pronto para o volume de GA4, GSC e
Semrush. Custa schema, migrations e um segredo a rotacionar. No plano gratuito,
o banco hiberna após dias sem uso e a primeira request depois disso é lenta.

**n8n como API, sem persistência.** O dashboard chamaria o webhook do n8n a cada
carregamento. Zero armazenamento, porém sem histórico e com o dashboard fora do
ar sempre que o n8n estiver.

**Google Sheets.** O n8n tem nó nativo de append — nenhuma linha de código do
nosso lado. Custo zero. O time de marketing enxerga e corrige o dado bruto sem
depender de engenharia.

## Decisão

Google Sheets, **atrás da interface `FunnelRepository`**.

A abstração é a metade que torna a escolha barata: a planilha resolve o presente
sem comprometer o futuro, porque trocá-la é escrever uma implementação nova, e
não refatorar a UI. `tests/architecture.test.ts` mantém essa fronteira.

## Consequências

Não dá para consultar de verdade — a leitura traz as linhas e o filtro acontece
em memória. Aceitável no volume atual; deixa de ser em dezenas de milhares de
linhas.

A latência da API do Sheets (perto de um segundo) obriga a cachear. Isso já está
resolvido em `funnel-service.ts`.

**A planilha guarda apenas números agregados.** Nenhuma coluna pode identificar
uma pessoa. Essa restrição não é preferência de modelagem: uma planilha é fácil
demais de compartilhar por acidente, e dado pessoal de lead ali seria exposição
de LGPD. É o que torna a decisão aceitável.

## Quando revisar

Qualquer um destes gatilhos:

- A planilha passa de ~10 mil linhas
- Entra a primeira fonte de GA4, GSC ou Semrush
- Alguém precisa de um recorte que exija consulta de verdade
- Surge necessidade de guardar dado em nível de lead

Na revisão, a saída provável é `PostgresFunnelRepository`.
