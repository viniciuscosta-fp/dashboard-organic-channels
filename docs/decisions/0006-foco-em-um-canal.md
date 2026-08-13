# 0006 — Foco em um canal

- **Status:** aceita
- **Data:** 2026-08-13

## Contexto

Até aqui o dashboard era sempre o consolidado. A pendência de filtro por canal
estava registrada em `docs/architecture.md` desde a V1: `FunnelQuery.channels` e
`applyFunnelQuery` já existiam e nenhum controle da tela os usava.

O gesto que faltava é o que vem naturalmente depois de ver um canal em risco na
tabela: abrir aquele canal.

## Decisão 1 — Seleção única, não subconjunto

Um canal por vez, via `?canal=<chave>`.

Multisseleção sem JavaScript exigiria caixas de seleção mais um botão "Aplicar",
e criaria um estado vazio ambíguo — nenhum canal marcado significa todos ou
nenhum? É funcionalidade de usuário avançado para um dashboard cuja qualidade
principal é responder em três segundos.

`FunnelQuery.channels` continua sendo uma lista, então um valor único já cabe e a
porta para multisseleção fica aberta sem tocar na camada de dados.

O controle segue o padrão do seletor de período: links, sem JavaScript, estado
inteiro compartilhável por URL. Consolidado é a **ausência** do parâmetro, não um
valor especial — assim a URL do estado padrão é a URL limpa.

## Decisão 2 — O foco escopa os agregados; não escopa as comparações

| Bloco               | Com um canal em foco                        |
| ------------------- | ------------------------------------------- |
| Os quatro cartões   | do canal                                    |
| Aderência acumulada | do canal, com meta e ritmo do canal         |
| Etapas do funil     | do canal                                    |
| Evolução por canal  | **todos**, com o canal em traço mais grosso |
| Taxas de conversão  | **todos**, com a linha do canal em foco     |
| Aderência por canal | **todos**, com a linha do canal em foco     |

Filtrar uma tabela de comparação para uma linha só destrói exatamente o que a
torna útil. Quem clicou num canal ainda quer saber como ele se compara aos
outros — é para isso que se olha um canal.

Isso cria uma ambiguidade real: metade da tela mudou de significado e a outra
metade não. A defesa é textual, em dois lugares, e não pode ser removida:

1. **`ScopeNotice`**, logo abaixo dos controles, diz em uma frase o que o foco
   escopa e o que segue completo
2. **Todo `hint` de card nomeia o próprio escopo** — "Todos os canais · …" ou o
   nome do canal. Um card que muda com o filtro e não diz de quem são os números
   é um bug de leitura, mesmo compilando

## Decisão 3 — A curva de burn-up sai do mesmo objeto que os cartões

`computeAdherence` ganhou `focusChannel`. A curva é construída a partir do
`ChannelAdherence` daquele canal — o mesmo que alimenta os cartões de KPI —, e
não de um cálculo paralelo.

O acoplamento é o ponto: o `dailyRate` da curva é o `recentDailyRate` daquele
canal, e é `null` exatamente quando a projeção daquele canal é `null`. Recalcular
o ritmo aqui seria a forma mais fácil de a curva e o número logo acima dela
passarem a discordar numa reunião.

A **régua de tempo continua global**. `businessDaysElapsed` e a janela de
tendência vêm da última data com dado da coleta inteira, não do canal. Um canal
que parou de reportar tem o ritmo puxado para baixo pelos dias zerados, que é o
comportamento correto e já documentado em `recentDailyRate`: dia útil sem linha é
um dia de resultado zero, não um dia que não existiu.

## Decisão 4 — O universo do cálculo não muda quando se filtra

O conjunto de canais que rateia a meta é o mesmo com ou sem foco. Se filtrar
alterasse esse conjunto, a meta consolidada mudaria ao clicar num canal — e o
mesmo número apareceria diferente em duas navegações.

`computeAdherence` também passou a aceitar `channels`, o cadastro da aba
`canais`, **unido** aos canais derivados do dado e das metas. Isso conserta uma
lacuna que existia desde a V1: um canal recém-cadastrado, sem dado e sem meta, não
aparecia em lugar nenhum. Agora aparece zerado, como já acontecia com canal que
tem meta e não tem resultado.

## Decisão 5 — O filtro é aplicado depois da busca

`applyFunnelQuery` roda sobre o que já veio da fonte. **Nunca** dentro do
argumento de `getFunnelSnapshots`.

No argumento, o canal entraria na chave do `use cache` e fragmentaria o cache de
uma entrada por período para uma por período × canal — seis vezes mais leituras
da API do Sheets, a cerca de um segundo cada. E as tabelas de comparação precisam
de todos os canais de qualquer forma, então a leitura completa não é desperdício:
é o que a tela usa.

## Decisão 6 — Canal desconhecido cai no consolidado, em silêncio

A validação acontece em dois tempos, porque a lista de canais válidos vem do
dado, que só é buscado depois de a URL ser lida: `parseDashboardParams` devolve a
chave crua, e `resolveChannelParam` a reconcilia contra o catálogo na rota.

Chave que não existe vira consolidado sem erro. A taxonomia de canais muda com
uma linha na planilha, então um link compartilhado semanas atrás pode apontar
para um canal que não existe mais — cair no consolidado mostra o dashboard,
derrubar a página não mostra nada. É a mesma filosofia de `parsePeriod`.

## Consequências

`AdherenceReport` ganhou `burnupChannel`, para a tela saber a que escopo a curva
se refere sem recalcular.

A pendência de filtro por canal sai de `docs/architecture.md`.

## Quando revisar

- Alguém precisar comparar dois ou três canais entre si sem os demais, o que
  pediria multisseleção
- Entrar um recorte por linha de negócio (`professional` / `abroad`), hoje fixo no
  Apps Script: seriam dois eixos de filtro, e a regra de escopo precisaria valer
  para a combinação
- O número de canais crescer a ponto de as pílulas não caberem em duas linhas
