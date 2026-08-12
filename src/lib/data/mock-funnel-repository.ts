import { applyFunnelQuery } from './funnel-query'
import type { FunnelRepository } from './funnel-repository'
import type { FunnelQuery, FunnelSnapshot } from './types'

/**
 * Doze meses de dados fictícios, com formato idêntico ao da planilha real.
 *
 * Números inventados e plausíveis: crescimento leve ao longo do ano e taxas de
 * conversão estáveis entre etapas. Servem para desenvolver e testar a UI sem
 * depender de credencial nenhuma.
 */
export const MOCK_SNAPSHOTS: readonly FunnelSnapshot[] = [
  { date: '2025-09-01', channel: 'organic-search', mqls: 182, opportunities: 41, customers: 9 },
  { date: '2025-09-01', channel: 'direct', mqls: 74, opportunities: 19, customers: 5 },
  { date: '2025-09-01', channel: 'referral', mqls: 31, opportunities: 8, customers: 2 },
  {
    date: '2025-10-01',
    channel: 'organic-search',
    mqls: 196,
    opportunities: 47,
    customers: 11,
  },
  { date: '2025-10-01', channel: 'direct', mqls: 81, opportunities: 21, customers: 6 },
  { date: '2025-10-01', channel: 'referral', mqls: 28, opportunities: 7, customers: 1 },
  {
    date: '2025-11-01',
    channel: 'organic-search',
    mqls: 214,
    opportunities: 52,
    customers: 13,
  },
  { date: '2025-11-01', channel: 'direct', mqls: 88, opportunities: 22, customers: 6 },
  { date: '2025-11-01', channel: 'referral', mqls: 35, opportunities: 9, customers: 2 },
  { date: '2025-12-01', channel: 'organic-search', mqls: 173, opportunities: 39, customers: 8 },
  { date: '2025-12-01', channel: 'direct', mqls: 69, opportunities: 16, customers: 4 },
  { date: '2025-12-01', channel: 'referral', mqls: 22, opportunities: 5, customers: 1 },
  {
    date: '2026-01-01',
    channel: 'organic-search',
    mqls: 241,
    opportunities: 61,
    customers: 15,
  },
  { date: '2026-01-01', channel: 'direct', mqls: 95, opportunities: 25, customers: 7 },
  { date: '2026-01-01', channel: 'referral', mqls: 39, opportunities: 10, customers: 3 },
  {
    date: '2026-02-01',
    channel: 'organic-search',
    mqls: 228,
    opportunities: 57,
    customers: 14,
  },
  { date: '2026-02-01', channel: 'direct', mqls: 92, opportunities: 24, customers: 6 },
  { date: '2026-02-01', channel: 'referral', mqls: 41, opportunities: 11, customers: 3 },
  {
    date: '2026-03-01',
    channel: 'organic-search',
    mqls: 259,
    opportunities: 66,
    customers: 17,
  },
  { date: '2026-03-01', channel: 'direct', mqls: 103, opportunities: 27, customers: 8 },
  { date: '2026-03-01', channel: 'referral', mqls: 44, opportunities: 12, customers: 3 },
  {
    date: '2026-04-01',
    channel: 'organic-search',
    mqls: 247,
    opportunities: 62,
    customers: 15,
  },
  { date: '2026-04-01', channel: 'direct', mqls: 98, opportunities: 26, customers: 7 },
  { date: '2026-04-01', channel: 'referral', mqls: 37, opportunities: 9, customers: 2 },
  {
    date: '2026-05-01',
    channel: 'organic-search',
    mqls: 273,
    opportunities: 71,
    customers: 19,
  },
  { date: '2026-05-01', channel: 'direct', mqls: 109, opportunities: 29, customers: 8 },
  { date: '2026-05-01', channel: 'referral', mqls: 46, opportunities: 13, customers: 4 },
  {
    date: '2026-06-01',
    channel: 'organic-search',
    mqls: 288,
    opportunities: 76,
    customers: 21,
  },
  { date: '2026-06-01', channel: 'direct', mqls: 114, opportunities: 31, customers: 9 },
  { date: '2026-06-01', channel: 'referral', mqls: 49, opportunities: 14, customers: 4 },
  {
    date: '2026-07-01',
    channel: 'organic-search',
    mqls: 301,
    opportunities: 79,
    customers: 22,
  },
  { date: '2026-07-01', channel: 'direct', mqls: 118, opportunities: 32, customers: 9 },
  { date: '2026-07-01', channel: 'referral', mqls: 52, opportunities: 15, customers: 5 },
  {
    date: '2026-08-01',
    channel: 'organic-search',
    mqls: 316,
    opportunities: 84,
    customers: 24,
  },
  { date: '2026-08-01', channel: 'direct', mqls: 123, opportunities: 34, customers: 10 },
  { date: '2026-08-01', channel: 'referral', mqls: 55, opportunities: 16, customers: 5 },
]

/**
 * Implementação em memória usada em desenvolvimento e nos testes.
 *
 * É a implementação padrão: `npm run dev` funciona logo após o clone, sem
 * credencial nenhuma.
 */
export class MockFunnelRepository implements FunnelRepository {
  readonly source = 'mock' as const

  constructor(private readonly snapshots: readonly FunnelSnapshot[] = MOCK_SNAPSHOTS) {}

  async getSnapshots(query?: FunnelQuery): Promise<FunnelSnapshot[]> {
    return applyFunnelQuery(this.snapshots, query)
  }
}
