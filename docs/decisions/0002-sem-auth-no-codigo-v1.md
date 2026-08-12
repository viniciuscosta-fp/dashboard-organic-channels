# 0002 — Sem autenticação no código na V1

- **Status:** parcialmente superada — ver "Atualização"
- **Data:** 2026-08-12

## Atualização (2026-08-12)

A Vercel foi **descartada** por restrições de compliance da empresa. Com isso
cai a segunda metade desta decisão: não há mais Deployment Protection para
delegar o controle de acesso.

O que permanece válido: não há nada de autenticação espalhado pelo código, então
adicionar Auth.js continua sendo trabalho aditivo, não refactor.

O que ficou em aberto: **onde hospedar e como proteger o acesso**. Enquanto isso
não for decidido, o dashboard roda apenas localmente. A escolha de hospedagem e
a de autenticação passam a ser a mesma decisão, e merecem uma ADR nova quando
forem tomadas.

## Contexto

O dashboard mostra números do funil comercial. Não são dados pessoais, mas são
informação interna que não deve ficar pública.

## Alternativas

**Auth.js com Google, restrito a `@fluencypass.com`.** Controle no código,
independente de fornecedor de hospedagem. Custa uma dependência, um fluxo de
sessão e um segredo a mais.

**Deployment Protection da Vercel.** Zero código. O acesso é resolvido na borda,
antes da aplicação.

**Sem proteção.** Descartada: números de funil comercial não devem ficar
abertos.

## Decisão

Nenhuma autenticação no código na V1. O acesso é restrito pela Deployment
Protection da Vercel.

A escolha é reversível: como não há nada de auth espalhado pelo código, adicionar
Auth.js depois não desfaz trabalho nenhum.

## Pendência

**A proteção por senha da Vercel é recurso de plano pago.** A opção gratuita
restringe o acesso a membros do time Vercel, o que pode não cobrir quem precisa
ver o dashboard.

Antes de tratar o dashboard como protegido, confirme no plano atual qual modo de
Deployment Protection está de fato ativo. Se o modo disponível não atender, esta
decisão cai e a saída é Auth.js.

## Consequências

Quem acessa o dashboard não é identificado pela aplicação — não há registro de
quem viu o quê. Se auditoria de acesso virar requisito, esta decisão precisa
mudar.

## Quando revisar

- O modo de proteção disponível no plano não cobrir quem precisa de acesso
- O dashboard passar a mostrar qualquer dado em nível de pessoa
- Surgir necessidade de permissão por perfil ou de auditoria de acesso
