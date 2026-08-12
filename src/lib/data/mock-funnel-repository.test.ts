import { describe, expect, it } from 'vitest'

import { isBusinessDay } from '../business-days'
import { sumFunnelStages } from './funnel-query'
import { generateSnapshots, MockFunnelRepository } from './mock-funnel-repository'

const AGOSTO = { from: '2026-08-01', to: '2026-08-31' }

describe('generateSnapshots', () => {
  it('gera uma linha por dia e canal, incluindo fim de semana', () => {
    const snapshots = generateSnapshots('2026-08-01', '2026-08-07')

    expect(snapshots).toHaveLength(7 * 3)
    expect(new Set(snapshots.map((s) => s.channel))).toEqual(
      new Set(['organic-search', 'direct', 'referral']),
    )
  })

  it('é determinístico: a mesma consulta devolve os mesmos números', () => {
    expect(generateSnapshots(AGOSTO.from, AGOSTO.to)).toEqual(
      generateSnapshots(AGOSTO.from, AGOSTO.to),
    )
  })

  it('o valor de um dia não depende do intervalo pedido', () => {
    const doMes = generateSnapshots(AGOSTO.from, AGOSTO.to).find(
      (s) => s.date === '2026-08-12' && s.channel === 'direct',
    )
    const doDia = generateSnapshots('2026-08-12', '2026-08-12').find((s) => s.channel === 'direct')

    expect(doMes).toEqual(doDia)
  })

  it('derruba o volume no fim de semana', () => {
    const snapshots = generateSnapshots(AGOSTO.from, AGOSTO.to).filter(
      (s) => s.channel === 'organic-search',
    )

    const uteis = snapshots.filter((s) => isBusinessDay(s.date))
    const fimDeSemana = snapshots.filter((s) => !isBusinessDay(s.date))

    const media = (list: typeof snapshots) => list.reduce((sum, s) => sum + s.mqls, 0) / list.length

    expect(media(fimDeSemana)).toBeLessThan(media(uteis) * 0.2)
  })

  it('mantém a hierarquia do funil no acumulado do mês', () => {
    const totals = sumFunnelStages(
      generateSnapshots(AGOSTO.from, AGOSTO.to).filter((s) => s.channel === 'organic-search'),
    )

    expect(totals.mqls).toBeGreaterThan(totals.opportunities)
    expect(totals.opportunities).toBeGreaterThan(totals.customers)
  })

  it('produz clientes mesmo no canal de menor volume', () => {
    const totals = sumFunnelStages(
      generateSnapshots(AGOSTO.from, AGOSTO.to).filter((s) => s.channel === 'referral'),
    )

    expect(totals.customers).toBeGreaterThan(0)
  })

  it('devolve vazio para intervalo invertido', () => {
    expect(generateSnapshots('2026-08-31', '2026-08-01')).toEqual([])
  })
})

describe('MockFunnelRepository', () => {
  it('se identifica como fonte mock', () => {
    expect(new MockFunnelRepository().source).toBe('mock')
  })

  it('respeita o intervalo pedido na consulta', async () => {
    const result = await new MockFunnelRepository().getSnapshots(AGOSTO)

    expect(result.at(0)?.date).toBe('2026-08-01')
    expect(result.at(-1)?.date).toBe('2026-08-31')
  })

  it('aplica o filtro de canal', async () => {
    const result = await new MockFunnelRepository().getSnapshots({
      ...AGOSTO,
      channels: ['referral'],
    })

    expect(result.every((s) => s.channel === 'referral')).toBe(true)
  })

  it('devolve dados sem intervalo informado', async () => {
    const result = await new MockFunnelRepository().getSnapshots()

    expect(result.length).toBeGreaterThan(0)
  })
})
