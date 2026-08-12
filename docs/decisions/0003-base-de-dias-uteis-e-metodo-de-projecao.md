# 0003 — Dias úteis como base e projeção por ritmo recente

- **Status:** aceita
- **Data:** 2026-08-12

## Contexto

O dashboard passou a responder "estamos batendo a meta e onde vamos fechar".
Isso exige três definições que mudam todo número da tela: como ratear uma meta
mensal para um período parcial, o que conta como "ritmo", e quando uma projeção
é confiável o bastante para ser mostrada.

O pré-requisito foi mudar a granularidade da ingestão: o n8n passou a gravar uma
linha por dia. Com agregado mensal não existe ritmo intramês, e nenhuma
matemática recupera granularidade que não foi gravada.

## Decisão 1 — Dias úteis, segunda a sexta

O rateio da meta e a contagem do período usam **dias úteis**, sem descontar
feriados.

Funil B2B praticamente não produz no fim de semana. Ratear por dia corrido
acusaria atraso falso numa segunda-feira e daria falso conforto numa sexta: no
dia 3 de um mês que começa numa segunda, dias corridos apontam 9,7% da meta
decorrida contra 4,8% em dias úteis — quase o dobro de erro justamente quando
ainda dá tempo de reagir.

Feriados ficaram de fora por manutenção: a lista precisaria de revisão anual e
de tratamento de feriado municipal. O erro que isso introduz é de um dia útil em
alguns meses, bem menor que o erro que dias corridos introduziriam.

**A mesma base vale para o rateio e para a projeção.** Misturar as duas faria os
números brigarem entre si na mesma tela.

## Decisão 2 — Ritmo dos últimos 10 dias úteis

O ritmo é a média por dia útil nos **10 últimos dias úteis com dado**, o
equivalente a duas semanas de calendário.

Múltiplo de cinco neutraliza o efeito de dia da semana: uma janela de 7 dias
corridos pesaria diferente conforme caísse sobre um fim de semana. Dez, e não
cinco, porque canais pequenos produzem pouco por dia — `referral` fica perto de
2,6 MQLs por dia útil, e uma janela de uma semana oscilaria demais para servir
de tendência.

**A janela atravessa o início do período.** No dia 5 de um mês, a tendência do
canal são os dias úteis do fim do mês anterior. Limitar a janela ao período
selecionado deixaria a primeira quinzena inteira sem projeção, que é exatamente
quando a informação vale mais. Por isso a consulta busca 21 dias corridos a mais
que o período (`LOOKBACK_TENDENCIA_DIAS`).

## Decisão 3 — A âncora é a última data com dado

O decorrido é medido contra a **última data presente nos dados**, não contra o
calendário.

Se o flow do n8n atrasar um dia, medir pelo calendário diluiria o realizado por
um dia a mais e acusaria um atraso que não aconteceu. Em compensação, um flow
quebrado passaria despercebido — por isso a data do último dado é exibida na
tela, ao lado do período.

## Decisão 4 — Confiança explícita

| Situação                           | Comportamento                             |
| ---------------------------------- | ----------------------------------------- |
| Menos de 5 dias úteis de histórico | Não projeta; diz que falta histórico      |
| Menos de 30% do período decorrido  | Projeta com aviso de baixa confiança      |
| Zero dias úteis restantes          | Período fechado; mostra o resultado final |

Projeção sem qualificação é o modo mais fácil de um dashboard mentir. Sem
projeção, o status ainda compara o realizado com a meta proporcional — responde
"estou atrás do ritmo agora?", que é pergunta diferente de "vou fechar abaixo?"
mas igualmente acionável.

Mês sem meta cadastrada **nunca** vira meta zero: seria 100% de atingimento
contra nada. Vira um estado neutro próprio, sinalizado na interface.

## Consequências

Todos os limiares e janelas são constantes nomeadas no topo de
`src/lib/data/goal-math.ts`. Mudá-los é uma linha, sem tocar em lógica.

A projeção é linear. Ela não captura sazonalidade de fim de mês, campanha
pontual nem efeito de feriado — e não deve ser lida como previsão, só como
"onde isso chega mantendo o ritmo atual".

## Quando revisar

- O time notar que fim de mês tem comportamento sistematicamente diferente do
  resto, o que pediria um modelo com peso por posição no mês
- Feriados nacionais causarem desvio perceptível na leitura
- Entrarem canais com sazonalidade semanal muito distinta entre si, que uma
  janela única deixaria de representar
- A granularidade mudar de novo, por exemplo se GA4 ou GSC entrarem com
  agregação diferente da do HubSpot
