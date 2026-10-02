---
paths:
  - 'src/components/**'
  - 'src/app/**/*.tsx'
---

# Componentes

## Atomic Design

| Pasta        | Responsabilidade                            | Exemplo               |
| ------------ | ------------------------------------------- | --------------------- |
| `atoms/`     | Elemento indivisível, sem lógica de domínio | `card.tsx`            |
| `molecules/` | Poucos átomos com um propósito só           | `kpi-card.tsx`        |
| `organisms/` | Bloco completo do dashboard                 | `channel-table.tsx`   |
| `templates/` | Layout de página, sem dados                 | `dashboard-shell.tsx` |

Componente só sobe de nível quando ganha responsabilidade — não crie um
organism para embrulhar uma molecule.

## Server por padrão

`'use client'` só quando o componente precisa de estado, evento ou de uma
biblioteca que exige DOM (hoje: os gráficos do Recharts). Todo o resto é Server
Component.

Buscar dados é responsabilidade da rota, em `src/app/**/page.tsx`. Componentes
recebem dados prontos por props — isso é o que os mantém testáveis sem mock de
rede.

## Cores

Nunca escreva hex em componente. Use os tokens de `globals.css`:

- `--series-1..5` para **grupos** de canais, sempre via `channelColors` /
  `colorOf` de `lib/series-colors.ts` — a cor segue o grupo, nunca a posição no
  ranking, e nunca é a única pista: todo ponto de cor tem o nome do canal ao lado
- `--stage-1..3` para etapas do funil, na ordem do funil
- `--ink`, `--ink-secondary`, `--ink-muted` para texto; nunca a cor da série

Os hexes foram validados para daltonismo e contraste nos dois modos. Trocar um
exige revalidar a paleta inteira, não só o slot alterado.

## Gráficos

Todo gráfico leva tooltip no hover, e legenda sempre que houver duas séries ou
mais — identidade de série nunca depende só da cor. Comparação entre canais é
_small multiples_ (um painel por canal, com o nome no título), não um gráfico
com uma linha por canal: com dez ou quinze canais isso vira um novelo. Nada de eixo duplo: duas
medidas de escalas diferentes viram dois gráficos.

## Acessibilidade

Texto em português. Elemento decorativo leva `aria-hidden`. Tabela usa `th` com
`scope`. Coluna numérica usa `tabular-nums`.
