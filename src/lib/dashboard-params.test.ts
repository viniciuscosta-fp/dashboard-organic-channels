import { describe, expect, it } from 'vitest'

import {
  dashboardSearchParams,
  DEFAULT_METRIC,
  DEFAULT_RATIO,
  parseDashboardParams,
  resolveChannelParam,
} from './dashboard-params'

const HOJE = '2026-08-14'

describe('parseDashboardParams', () => {
  it('lê os três eixos da URL', () => {
    const params = parseDashboardParams(
      { periodo: 'mes-anterior', metrica: 'customers', taxa: 'mql-to-customer' },
      HOJE,
    )

    expect(params.presetId).toBe('mes-anterior')
    expect(params.metric).toBe('customers')
    expect(params.ratio).toBe('mql-to-customer')
  })

  it('cai no padrão sem nenhum parâmetro', () => {
    const params = parseDashboardParams({}, HOJE)

    expect(params.presetId).toBe('mes-atual')
    expect(params.metric).toBe(DEFAULT_METRIC)
    expect(params.ratio).toBe(DEFAULT_RATIO)
    expect(params.channel).toBeNull()
  })

  it('lê o canal cru, sem validar contra o catálogo', () => {
    expect(parseDashboardParams({ canal: 'brand' }, HOJE).channel).toBe('brand')
    expect(parseDashboardParams({ canal: 'canal_que_nao_existe' }, HOJE).channel).toBe(
      'canal_que_nao_existe',
    )
  })

  it('trata canal em branco como consolidado', () => {
    expect(parseDashboardParams({ canal: '   ' }, HOJE).channel).toBeNull()
    expect(parseDashboardParams({ canal: '' }, HOJE).channel).toBeNull()
  })

  it('cai no padrão com taxa desconhecida, sem derrubar a página', () => {
    expect(parseDashboardParams({ taxa: 'mql-to-unicornio' }, HOJE).ratio).toBe(DEFAULT_RATIO)
  })

  it('cai no padrão com métrica desconhecida', () => {
    expect(parseDashboardParams({ metrica: 'lucro' }, HOJE).metric).toBe(DEFAULT_METRIC)
  })

  it('reconhece intervalo personalizado como ausência de preset', () => {
    const params = parseDashboardParams({ de: '2026-07-01', ate: '2026-07-20' }, HOJE)

    expect(params.presetId).toBeNull()
    expect(params.range).toEqual({ from: '2026-07-01', to: '2026-07-20' })
  })

  it('fica com o primeiro valor quando a chave repete', () => {
    expect(
      parseDashboardParams({ taxa: ['mql-to-customer', 'mql-to-opportunity'] }, HOJE).ratio,
    ).toBe('mql-to-customer')
  })
})

describe('resolveChannelParam', () => {
  const canais = ['organic_site', 'brand']

  it('mantém canal que existe no catálogo', () => {
    expect(resolveChannelParam('brand', canais)).toBe('brand')
  })

  it('cai no consolidado com canal desconhecido, em vez de derrubar a página', () => {
    expect(resolveChannelParam('canal_extinto', canais)).toBeNull()
  })

  it('cai no consolidado quando não há canal', () => {
    expect(resolveChannelParam(null, canais)).toBeNull()
  })

  it('cai no consolidado quando não há catálogo', () => {
    expect(resolveChannelParam('brand', [])).toBeNull()
  })
})

describe('dashboardSearchParams', () => {
  const comPreset = parseDashboardParams(
    { periodo: 'ultimos-30-dias', metrica: 'customers', taxa: 'mql-to-customer' },
    HOJE,
  )
  const comCanal = parseDashboardParams(
    { periodo: 'mes-atual', metrica: 'mqls', taxa: 'mql-to-customer', canal: 'brand' },
    HOJE,
  )
  const comIntervalo = parseDashboardParams(
    { de: '2026-07-01', ate: '2026-07-20', metrica: 'mqls', taxa: 'opportunity-to-customer' },
    HOJE,
  )

  it('reproduz o estado inteiro quando nada é omitido', () => {
    expect(dashboardSearchParams(comPreset)).toEqual({
      periodo: 'ultimos-30-dias',
      metrica: 'customers',
      taxa: 'mql-to-customer',
    })
  })

  it('trocar de taxa preserva período e métrica', () => {
    expect(dashboardSearchParams(comPreset, ['taxa'])).toEqual({
      periodo: 'ultimos-30-dias',
      metrica: 'customers',
    })
  })

  it('trocar de taxa preserva o intervalo personalizado', () => {
    expect(dashboardSearchParams(comIntervalo, ['taxa'])).toEqual({
      de: '2026-07-01',
      ate: '2026-07-20',
      metrica: 'mqls',
    })
  })

  it('trocar de métrica preserva a taxa', () => {
    expect(dashboardSearchParams(comPreset, ['metrica'])).toEqual({
      periodo: 'ultimos-30-dias',
      taxa: 'mql-to-customer',
    })
  })

  it('trocar de período preserva métrica e taxa', () => {
    expect(dashboardSearchParams(comPreset, ['periodo'])).toEqual({
      metrica: 'customers',
      taxa: 'mql-to-customer',
    })
  })

  it('omitir o período derruba também o intervalo personalizado', () => {
    const query = dashboardSearchParams(comIntervalo, ['periodo'])

    expect(query).not.toHaveProperty('de')
    expect(query).not.toHaveProperty('ate')
    expect(query).not.toHaveProperty('periodo')
  })

  it('omite o canal quando o escopo é o consolidado', () => {
    expect(dashboardSearchParams(comPreset)).not.toHaveProperty('canal')
  })

  it('trocar de canal preserva período, métrica e taxa', () => {
    expect(dashboardSearchParams(comCanal, ['canal'])).toEqual({
      periodo: 'mes-atual',
      metrica: 'mqls',
      taxa: 'mql-to-customer',
    })
  })

  it('trocar de taxa preserva o canal', () => {
    expect(dashboardSearchParams(comCanal, ['taxa']).canal).toBe('brand')
  })

  it('trocar de período preserva o canal', () => {
    expect(dashboardSearchParams(comCanal, ['periodo']).canal).toBe('brand')
  })

  it('trocar de métrica preserva o canal', () => {
    expect(dashboardSearchParams(comCanal, ['metrica']).canal).toBe('brand')
  })

  it('a ida e a volta pela URL preservam o estado', () => {
    const query = dashboardSearchParams(comIntervalo)

    expect(parseDashboardParams(query, HOJE)).toEqual(comIntervalo)
  })

  it('a ida e a volta preservam o canal', () => {
    expect(parseDashboardParams(dashboardSearchParams(comCanal), HOJE)).toEqual(comCanal)
  })

  describe('grupos', () => {
    const comGrupo = parseDashboardParams(
      {
        periodo: 'mes-atual',
        metrica: 'mqls',
        taxa: 'mql-to-customer',
        grupo: 'Pago',
        grupos: 'Pago~paid_search,paid_social|IA~ai_referrals',
      },
      HOJE,
    )

    it('lê o grupo selecionado e os grupos personalizados', () => {
      expect(comGrupo.group).toBe('Pago')
      expect(comGrupo.customGroups).toEqual([
        { name: 'Pago', channels: ['paid_search', 'paid_social'] },
        { name: 'IA', channels: ['ai_referrals'] },
      ])
    })

    it('sem os parâmetros, não há grupo nem grupos personalizados', () => {
      expect(comPreset.group).toBeNull()
      expect(comPreset.customGroups).toEqual([])
      expect(dashboardSearchParams(comPreset)).not.toHaveProperty('grupos')
    })

    it('trocar de período, métrica ou taxa preserva grupo e grupos personalizados', () => {
      for (const control of ['periodo', 'metrica', 'taxa'] as const) {
        const query = dashboardSearchParams(comGrupo, [control])

        expect(query.grupo).toBe('Pago')
        expect(query.grupos).toBe('Pago~paid_search,paid_social|IA~ai_referrals')
      }
    })

    it('trocar de seleção omite canal e grupo, mas preserva os grupos personalizados', () => {
      const query = dashboardSearchParams(comGrupo, ['canal', 'grupo'])

      expect(query).not.toHaveProperty('grupo')
      expect(query).not.toHaveProperty('canal')
      expect(query.grupos).toBe('Pago~paid_search,paid_social|IA~ai_referrals')
    })

    it('a ida e a volta preservam grupo e grupos personalizados', () => {
      expect(parseDashboardParams(dashboardSearchParams(comGrupo), HOJE)).toEqual(comGrupo)
    })
  })
})
