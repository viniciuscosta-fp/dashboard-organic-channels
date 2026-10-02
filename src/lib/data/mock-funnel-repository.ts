import { eachDay, isBusinessDay } from '../business-days'
import { applyFunnelQuery } from './funnel-query'
import type { FunnelRepository } from './funnel-repository'
import type { FunnelQuery, FunnelSnapshot } from './types'

/**
 * Fonte de exemplo usada em desenvolvimento e nos testes.
 *
 * Os números são **gerados**, não tabelados: um ano de dado diário em três
 * canais daria mais de mil linhas escritas à mão, ilegíveis e impossíveis de
 * manter. O gerador embute duas características do dado real que a lógica de
 * negócio precisa exercitar — queda para quase zero no fim de semana e leve
 * tendência de alta ao longo do tempo.
 *
 * A geração é **determinística**: o mesmo dia e canal sempre produzem o mesmo
 * número. Valor aleatório a cada chamada quebraria `use cache` e a hidratação
 * do React, além de fazer o dashboard mudar sozinho a cada recarga.
 *
 * Não lê relógio. O intervalo pedido é a única entrada — quem decide não pedir
 * datas futuras é a rota, em `src/app/page.tsx`.
 */

interface ChannelProfile {
  name: string
  /** MQLs por dia útil no início da série. */
  baseMqls: number
  /** Crescimento composto por dia corrido. */
  dailyGrowth: number
  /** Fração de MQLs que vira oportunidade. */
  opportunityRate: number
  /** Fração de oportunidades que vira cliente. */
  customerRate: number
  /** Ticket médio em reais, usado para derivar a receita dos clientes do dia. */
  averageTicket: number
}

/**
 * Os dez canais de `MOCK_CHANNELS`: os cinco primeiros com as chaves aceitas
 * pelo webhook, os cinco últimos fictícios, para exercitar o layout com mais
 * canais. Os volumes variam de propósito — um canal pequeno ao lado de um
 * grande é o caso que um gráfico de escala única esconde.
 */
const CHANNELS: ChannelProfile[] = [
  {
    name: 'organic_site',
    baseMqls: 11,
    dailyGrowth: 0.0006,
    opportunityRate: 0.26,
    customerRate: 0.28,
    averageTicket: 2400,
  },
  {
    name: 'blog_fluencypass',
    baseMqls: 6,
    dailyGrowth: 0.0005,
    opportunityRate: 0.24,
    customerRate: 0.26,
    averageTicket: 2200,
  },
  {
    name: 'compare',
    baseMqls: 4.5,
    dailyGrowth: 0.0004,
    opportunityRate: 0.3,
    customerRate: 0.32,
    averageTicket: 2600,
  },
  {
    name: 'brand',
    baseMqls: 3.5,
    dailyGrowth: 0.0003,
    opportunityRate: 0.35,
    customerRate: 0.4,
    averageTicket: 3200,
  },
  {
    name: 'ai_referrals',
    baseMqls: 1.8,
    dailyGrowth: 0.0018,
    opportunityRate: 0.28,
    customerRate: 0.3,
    averageTicket: 2800,
  },
  {
    name: 'paid_search',
    baseMqls: 9,
    dailyGrowth: 0.0004,
    opportunityRate: 0.25,
    customerRate: 0.27,
    averageTicket: 2500,
  },
  {
    name: 'paid_social',
    baseMqls: 6,
    dailyGrowth: 0.0006,
    opportunityRate: 0.18,
    customerRate: 0.22,
    averageTicket: 2100,
  },
  {
    name: 'paid_display',
    baseMqls: 3,
    dailyGrowth: 0.0002,
    opportunityRate: 0.15,
    customerRate: 0.2,
    averageTicket: 1900,
  },
  {
    name: 'social_instagram',
    baseMqls: 2.5,
    dailyGrowth: 0.0008,
    opportunityRate: 0.2,
    customerRate: 0.25,
    averageTicket: 2000,
  },
  {
    name: 'social_youtube',
    baseMqls: 1.5,
    dailyGrowth: 0.0012,
    opportunityRate: 0.22,
    customerRate: 0.27,
    averageTicket: 2300,
  },
]

/** Data a partir da qual a tendência de crescimento é contada. */
const SERIES_START = '2025-01-01'

/** Fim de semana não zera de todo — fica no ruído de formulário fora do horário. */
const WEEKEND_FACTOR = 0.05

/** FNV-1a: hash rápido e estável, suficiente para semear ruído de exemplo. */
function hash(seed: string): number {
  let value = 2_166_136_261

  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index)
    value = Math.imul(value, 16_777_619)
  }

  return value >>> 0
}

/** Ruído determinístico entre 0 e 1 para um par de dia e chave. */
function noise(date: string, key: string): number {
  return hash(`${date}:${key}`) / 4_294_967_296
}

function daysSinceStart(date: string): number {
  const from = new Date(`${SERIES_START}T00:00:00Z`).getTime()
  const to = new Date(`${date}T00:00:00Z`).getTime()
  return Math.max(0, Math.round((to - from) / 86_400_000))
}

/**
 * Arredondamento estocástico determinístico.
 *
 * Arredondar 0,3 para zero todo dia zeraria o mês inteiro de um canal pequeno —
 * era o que acontecia com os clientes de `referral`. Aqui a parte fracionária
 * vira a probabilidade de subir, o que preserva o total esperado no mês sem
 * abrir mão de determinismo, já que o sorteio vem do mesmo ruído semeado.
 */
function stochasticRound(value: number, seed: number): number {
  const floor = Math.floor(value)
  return floor + (seed < value - floor ? 1 : 0)
}

function snapshotFor(date: string, channel: ChannelProfile): FunnelSnapshot {
  const trend = (1 + channel.dailyGrowth) ** daysSinceStart(date)
  const weekday = isBusinessDay(date) ? 1 : WEEKEND_FACTOR

  // Ruído de ±25% em torno da base, para a série não sair artificialmente lisa.
  const variation = 0.75 + noise(date, `${channel.name}:mqls`) * 0.5
  const mqls = stochasticRound(
    channel.baseMqls * trend * weekday * variation,
    noise(date, `${channel.name}:mqls-round`),
  )

  const opportunities = stochasticRound(
    mqls * channel.opportunityRate * (0.8 + noise(date, `${channel.name}:opp`) * 0.4),
    noise(date, `${channel.name}:opp-round`),
  )

  const customers = stochasticRound(
    opportunities * channel.customerRate * (0.7 + noise(date, `${channel.name}:cust`) * 0.6),
    noise(date, `${channel.name}:cust-round`),
  )

  // Receita segue os clientes fechados no dia, com o ticket variando em ±15%.
  // Dia sem cliente é dia sem receita — é assim que o dado real se comporta.
  const revenue =
    customers === 0
      ? 0
      : Math.round(
          customers * channel.averageTicket * (0.85 + noise(date, `${channel.name}:ticket`) * 0.3),
        )

  return { date, channel: channel.name, revenue, mqls, opportunities, customers }
}

/** Gera uma linha por dia e canal no intervalo, inclusivo nas duas pontas. */
export function generateSnapshots(from: string, to: string): FunnelSnapshot[] {
  const snapshots: FunnelSnapshot[] = []

  for (const date of eachDay(from, to)) {
    for (const channel of CHANNELS) {
      snapshots.push(snapshotFor(date, channel))
    }
  }

  return snapshots
}

/** Intervalo gerado quando a consulta não delimita um período. */
const DEFAULT_RANGE = { from: '2025-06-01', to: '2026-12-31' }

export class MockFunnelRepository implements FunnelRepository {
  readonly source = 'mock' as const

  async getSnapshots(query?: FunnelQuery): Promise<FunnelSnapshot[]> {
    const from = query?.from ?? DEFAULT_RANGE.from
    const to = query?.to ?? DEFAULT_RANGE.to

    return applyFunnelQuery(generateSnapshots(from, to), query)
  }
}
