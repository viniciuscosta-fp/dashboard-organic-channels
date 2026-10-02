# Seleção por grupo e grupos personalizados

- **Status:** aprovada (decisões de 2026-10-02, abaixo)
- **Data:** 2026-10-02

## Problema

Com 12 canais, as pílulas do seletor ocupam quatro linhas no topo e poluem a
tela. E não existe forma de ver os números de um **grupo** de canais — só de um
canal ou de todos —, então "como está o pago?" não tem resposta direta. Quem
sente a falta é quem acompanha os canais em reunião de resultado.

## Escopo

**Entra:**

- Seletor compacto em menu suspenso (`<details>`, sem JavaScript): todos os
  canais, um grupo ou um canal
- Escolher um grupo escopa cartões, curva acumulada e funil à soma dos canais
  do grupo
- Com um grupo escolhido, "Situação dos canais", aderência por canal, evolução,
  conversão e valor mostram **só os canais do grupo**; conversão e valor trazem o
  total do grupo no rodapé
- Criar grupo personalizado na tela: nome e canais, por formulário
- Remover grupo personalizado
- Grupos da planilha (coluna `group`) aparecem como grupos prontos
- Cor volta a ser **fixa por canal**, pela ordem canônica: cinco cores, cinza do
  sexto em diante

**Não entra:**

- Persistência dos grupos personalizados em banco ou planilha — eles vivem na URL
- Editar ou renomear grupo existente (remover e criar de novo resolve)
- Multisseleção ad hoc fora de um grupo
- Corrigir a inflação do total quando falta meta de um canal (ver riscos)

## Dados necessários

Nenhuma coluna nova. A coluna opcional `group` da aba `canais` continua no
contrato e passa a significar "grupo pronto no seletor". `docs/data-contract.md`
muda só o texto que diz o que o grupo faz (cor deixa de seguir o grupo).

Estado novo na URL:

| Parâmetro | Formato                                      | Exemplo                                         |
| --------- | -------------------------------------------- | ----------------------------------------------- |
| `grupo`   | nome do grupo selecionado                    | `Pago`                                          |
| `grupos`  | grupos personalizados, `nome~canal,canal\|…` | `Pago~paid_search,paid_social\|IA~ai_referrals` |
| `aviso`   | motivo de um grupo recusado na criação       | `grupo-sem-canais`                              |

Nada pessoal: chaves de canal e nomes digitados pelo time.

## Interface

- **Seletor:** um botão-menu "Canais: Todos" / "Grupo: Pago" / "Canal: Busca
  paga". Aberto, lista grupos (prontos e personalizados, com "remover" nos
  personalizados) e canais, divididos por grupo da planilha. Ao lado, um segundo
  menu "Criar grupo", com campo de nome, caixas de seleção dos canais e botão. A
  forma é menu porque o trabalho é escolher um item entre 15 a 20 — não precisa
  ficar exposto o tempo todo.
- **Escopo:** `ScopeNotice` e o `hint` de cada card nomeiam o grupo e quantos
  canais ele soma.
- **Canal único:** segue a decisão 0006 — tabelas completas, com a linha em foco.

## Critérios de aceite

1. `npm run verify` passa
2. O topo não tem mais fileiras de pílulas de canal; o seletor ocupa uma linha
3. `?grupo=Pago` (grupo da planilha) mostra cartões, curva e funil somando só os
   canais do grupo, e as tabelas, a situação e a evolução só com eles
4. Criar um grupo pelo formulário leva a uma URL com `grupos=` e `grupo=` do grupo
   novo; recarregar a página mantém o grupo
5. Nome vazio, nenhum canal válido, nome repetido ou mais de 10 grupos são
   recusados com aviso legível no próprio formulário
6. Remover um grupo personalizado o tira do seletor e, se ele estava selecionado,
   volta para todos os canais
7. Trocar período, métrica ou taxa preserva grupo selecionado e grupos
   personalizados
8. `grupo=` desconhecido, `grupos=` malformado ou com canal inexistente caem no
   padrão em silêncio, sem quebrar a página
9. A meta do grupo é a soma das metas dos canais do grupo; o total geral e as
   linhas por canal não mudam ao escolher um grupo (decisão 0006, item 4)
10. Cada canal tem a mesma cor em todos os blocos, com ou sem grupo selecionado

## Riscos e questões em aberto

- **URL longa:** 10 grupos de 15 canais cabem com folga nos limites usuais, mas o
  link fica feio. Aceito, já que o link é a persistência
- **Meta faltando:** um grupo com canal sem meta herda o problema do total — o
  realizado soma o canal, a meta não. A régua avisa, o número fica inflado
- **Grupo personalizado com o mesmo nome de um da planilha:** recusado na criação
  para não haver dois "Pago"
- **Seleção de grupo muda a regra 0006 para as tabelas:** com canal único, as
  tabelas seguem completas; com grupo, mostram só o grupo. Registrado em
  `docs/decisions/0010`

**Decidido em 2026-10-02:** grupos na URL; coluna `group` da planilha vira grupo
pronto; cor fixa por canal; com grupo selecionado, tabelas e mini-gráficos só com
o grupo.
