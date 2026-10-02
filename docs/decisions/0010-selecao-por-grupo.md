# 0010 — Seleção por grupo e grupos criados na tela

- **Status:** aceita
- **Data:** 2026-10-02
- **Revê em parte:** 0009 (cor por grupo; seletor em pílulas)

## Contexto

Com 12 canais na planilha real, o seletor da decisão 0009 — uma fileira de
pílulas por grupo — passou a ocupar quatro linhas do topo. E não havia como ver
os números de um **grupo**: o dashboard escopava a um canal ou a todos, e "como
está o pago?" exigia somar de cabeça.

O time também prefere montar grupos na tela a fixá-los na planilha: a pergunta
muda de reunião para reunião, e editar a planilha para cada uma não escala.

A spec está em [`specs/selecao-por-grupo.md`](../specs/selecao-por-grupo.md).

## Decisão 1 — Seletor em menu suspenso

Um único botão abre um menu (`<details>`) com "Todos os canais", os grupos e os
canais. Sem JavaScript, cada item é um link, e o estado continua todo na URL.

O topo volta a ter uma linha de controles, seja qual for o número de canais.

## Decisão 2 — Grupo personalizado vive na URL

`?grupos=nome~canal,canal|nome~canal`. Não há banco nem gravação na planilha: o
link é a persistência. Recarregar mantém o grupo, compartilhar o link leva o
grupo junto, e abrir o dashboard por um link sem ele mostra só os grupos da
planilha.

Alternativas descartadas: estado só na aba aberta, porque some ao recarregar e
obrigaria a recalcular no cliente, contra a regra de que a rota calcula tudo; e
`localStorage`, porque o servidor não o enxerga, então os números do grupo
precisariam ser calculados no navegador do mesmo jeito.

A criação é um formulário `GET` para `/grupos`, um route handler que valida o
pedido e responde 303 para o dashboard com o grupo gravado e já selecionado. Se
recusar — nome vazio, nenhum canal, nome repetido, mais de dez grupos —, volta
com `?aviso=` e o formulário abre mostrando o motivo.

Limites: dez grupos, nomes de até 40 caracteres, sem `|` nem `~` (são os
separadores do formato). Grupo com o nome de um grupo da planilha é recusado,
para o menu nunca ter dois "Pago".

## Decisão 3 — A coluna `group` da planilha vira grupo pronto

Ela continua opcional e passa a significar "grupo que já aparece no menu". Sem
ela, só existem os grupos criados na tela.

## Decisão 4 — A cor volta a ser por canal

Grupos criados na tela podem se sobrepor: um canal em "Pago" e em "Campanha de
outubro" não teria cor definida se a cor seguisse o grupo. Então a cor voltou a
seguir o **canal**, pela ordem canônica, calculada sobre o catálogo inteiro —
escolher um grupo não repinta ninguém.

São cinco cores validadas; do sexto canal em diante, cinza. O nome ao lado de
todo ponto de cor, regra da decisão 0009, é o que segue identificando o canal.

## Decisão 5 — Grupo escopa agregados **e** comparações

Com um grupo selecionado:

| Bloco                           | Mostra                                            |
| ------------------------------- | ------------------------------------------------- |
| Cartões, curva acumulada, funil | a soma do grupo, contra a soma das metas dele     |
| Situação, aderência, evolução   | só os canais do grupo                             |
| Conversão e valor               | só os canais do grupo, com "Total de …" no rodapé |

Isso difere do canal único (decisão 0006), que mantém as comparações completas.
A diferença é deliberada: o canal único é escolhido para ver **um** canal contra
os outros; o grupo é escolhido justamente para comparar **dentro** dele. O
`ScopeNotice` diz em texto qual das duas regras está valendo.

Como na 0006, o universo do cálculo não muda: `total` e `byChannel` saem
completos de `computeAdherence`, e a restrição às linhas do grupo acontece na
rota. O consolidado de todos os canais é o mesmo número com ou sem grupo.

## Consequências

- `computeAdherence` ganhou `focusChannels` e devolve `scope`, o objeto que
  alimenta os cartões e de onde sai a curva
- `ChannelPicker` deu lugar a `ChannelSelector` e `GroupCreator`
- `channelColors` voltou a indexar por canal
- Nova rota `/grupos`, dinâmica

## Quando revisar

- Alguém precisar dos grupos personalizados em outro aparelho sem passar o
  link: aí a persistência vira banco, e a URL passa a guardar só a seleção
- Grupo com canal sem meta: o total do grupo herda a inflação do consolidado
  (realizado soma o canal, meta não). Se isso começar a confundir, o próximo
  passo é recusar a meta do grupo quando a cobertura for parcial, como a tabela
  de conversão já faz
