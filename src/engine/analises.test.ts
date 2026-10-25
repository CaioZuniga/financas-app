import { describe, expect, it } from 'vitest'
import {
  alivioDeCaixa,
  comprometimento,
  detectarRecorrencias,
  foraDoPadrao,
  gastoPorDiaDaSemana,
  independenciaFinanceira,
  mapaCalor,
  parcelasCartaoPorMes,
  rankingEstabelecimentos,
  reservaEmergencia,
  unificarGastos,
} from './analises'
import type { Categoria } from './categorias'
import type { MesProjetado } from './projecao'

const lanc = (faturaRef: string, descricao: string, valor: number, categoria: Categoria, extra: Partial<{ data: string; parcela: { atual: number; total: number }; ignorado: 0 | 1 }> = {}) => ({
  data: extra.data ?? `${faturaRef}-10`,
  descricao,
  valor,
  categoria,
  faturaRef,
  cartao: 'Nubank',
  ignorado: extra.ignorado ?? (0 as const),
  parcela: extra.parcela,
})

const lancs = [
  // Netflix todo mês (recorrente), Uber variando muito (não recorrente).
  ...['2026-07', '2026-08', '2026-09', '2026-10'].flatMap((m, i) => [
    lanc(m, 'Netflix.com', 55.9, 'Assinaturas'),
    lanc(m, 'Uber *Trip', [20, 150, 35, 90][i], 'Transporte'),
    lanc(m, 'Restaurante X', i === 3 ? 900 : 300, 'Restaurantes'),
  ]),
  lanc('2026-06', 'Spotify', 21.9, 'Assinaturas'),
  lanc('2026-07', 'Spotify', 21.9, 'Assinaturas'),
  lanc('2026-08', 'Spotify', 21.9, 'Assinaturas'), // cancelado depois
  lanc('2026-10', 'Loja Nova Eletronicos', 1200, 'Compras'),
  lanc('2026-10', 'TV parcelada', 250, 'Compras', { parcela: { atual: 3, total: 10 } }),
  lanc('2026-10', 'Pagamento recebido', -2000, 'Pagamentos', { ignorado: 1 }),
]
const movs = [
  { data: '2026-10-05', descricao: 'Pix enviado Diarista', valor: -600, categoria: 'Transferências' as const, conta: 'Itaú', ignorado: 0 as const },
  { data: '2026-10-08', descricao: 'Débito Escola', valor: -2900, categoria: 'Educação' as const, conta: 'Itaú', ignorado: 0 as const },
  { data: '2026-10-09', descricao: 'Salário', valor: 15000, categoria: 'Receitas' as const, conta: 'Itaú', ignorado: 0 as const },
]
const gastos = unificarGastos(lancs, movs)

describe('base', () => {
  it('une cartão e conta, sem pagamentos, receitas e transferências', () => {
    expect(gastos.some((g) => g.categoria === 'Pagamentos' || g.categoria === 'Transferências')).toBe(false)
    expect(gastos.find((g) => g.descricao === 'Débito Escola')).toMatchObject({ mes: '2026-10', valor: 2900, origem: 'Itaú' })
  })
})

describe('recorrências', () => {
  it('acha assinaturas de valor estável e marca as que pararam', () => {
    const r = detectarRecorrencias(gastos)
    const nomes = r.map((x) => x.nome)
    expect(nomes).toContain('Netflix.com')
    expect(nomes).toContain('Spotify')
    expect(nomes).not.toContain('Uber *Trip')
    expect(nomes).not.toContain('TV parcelada')
    expect(r.find((x) => x.nome === 'Netflix.com')).toMatchObject({ meses: 4, ativa: true, fixo: true })
    expect(nomes).not.toContain('Restaurante X') // valor muda demais (300 → 900)
    expect(r.find((x) => x.nome === 'Netflix.com')!.custoAnual).toBeCloseTo(670.8)
    expect(r.find((x) => x.nome === 'Spotify')!.ativa).toBe(false)
  })
})

describe('recorrências: frequência', () => {
  it('ignora o que cai várias vezes por mês', () => {
    const muitos = ['2026-08', '2026-09'].flatMap((m) => [1, 2, 3, 4].map((k) => lanc(m, 'Transação de NuTag', 14.5, 'Transporte', { data: `${m}-0${k}` })))
    expect(detectarRecorrencias(unificarGastos(muitos, []))).toEqual([])
  })
})

describe('fora do padrão', () => {
  it('alerta categoria acima da média e estabelecimento novo caro', () => {
    const d = foraDoPadrao(gastos, '2026-10')
    expect(d.find((x) => x.tipo === 'categoria' && x.categoria === 'Restaurantes')).toMatchObject({ valor: 900, referencia: 225, razao: 4 }) // jun/26 entra como zero
    expect(d.find((x) => x.tipo === 'novo')).toMatchObject({ rotulo: 'Loja Nova Eletronicos', valor: 1200 })
    expect(d.some((x) => x.categoria === 'Assinaturas')).toBe(false)
  })
  it('sem histórico não alerta', () => {
    expect(foraDoPadrao(gastos, '2026-06')).toEqual([])
  })
})

describe('mapa de calor e ranking', () => {
  it('monta matriz categoria × mês', () => {
    const m = mapaCalor(gastos)
    expect(m.meses).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10'])
    const i = m.categorias.indexOf('Restaurantes')
    expect(m.valores[i]).toEqual([0, 300, 300, 300, 900])
    expect(m.max).toBe(2900)
  })
  it('ranqueia estabelecimentos com ticket médio e dia favorito', () => {
    const r = rankingEstabelecimentos(gastos, ['2026-07', '2026-08', '2026-09', '2026-10'])
    const rest = r.find((e) => e.nome === 'Restaurante X')!
    expect(rest).toMatchObject({ vezes: 4, total: 1800, ticketMedio: 450 })
    expect(r[0].nome).toBe('Débito Escola')
    const dias = gastoPorDiaDaSemana(gastos, ['2026-10'])
    expect(dias.reduce((s, v) => s + v, 0)).toBeCloseTo(55.9 + 90 + 900 + 1200 + 250 + 2900)
  })
})

describe('planejamento', () => {
  const proj = (k: number): MesProjetado => ({
    mes: `2026-${String(10 + k).padStart(2, '0')}`,
    entradas: 10000,
    fixas: 3000,
    financiamento: 2500,
    dividas: k === 0 ? 1000 : 0,
    cartao: 2000,
    cartaoReal: false,
    saldo: 0,
    acumulado: 0,
  })
  const projecao = [0, 1, 2].map(proj)

  it('comprometimento de renda soma imóvel, dívidas e parcelas do cartão', () => {
    const c = comprometimento(projecao, new Map([['2026-10', 500]]))
    expect(c[0]).toMatchObject({ total: 4000, fracao: 0.4, nivel: 'atencao' })
    expect(c[1]).toMatchObject({ total: 2500, nivel: 'saudavel' })
  })

  it('parcelas do cartão: as da fatura importada + as futuras', () => {
    const m = parcelasCartaoPorMes(
      [lanc('2026-10', 'TV', 250, 'Compras', { parcela: { atual: 3, total: 5 } }), lanc('2026-10', 'Mercado', 500, 'Mercado')],
      new Map([['2026-10', 999], ['2026-11', 250]]),
    )
    expect(m.get('2026-10')).toBe(250) // fatura importada manda; a estimativa não soma
    expect(m.get('2026-11')).toBe(250)
  })

  it('reserva de emergência em meses de custo', () => {
    const ativos = [
      { nome: 'Conta', tipo: 'conta' as const, valor: 10000, rendimentoAnual: 0, atualizadoEm: '2026-10-01' },
      { nome: 'CDB', tipo: 'investimento' as const, valor: 20000, rendimentoAnual: 0.1, atualizadoEm: '2026-10-01' },
      { nome: 'Apto', tipo: 'imovel' as const, valor: 500000, rendimentoAnual: 0, atualizadoEm: '2026-10-01' },
    ]
    const r = reservaEmergencia(ativos, projecao)
    expect(r.custoMensal).toBeCloseTo((8500 + 7500 + 7500) / 3)
    expect(r.liquido).toBe(30000)
    expect(r.meses).toBeCloseTo(30000 / r.custoMensal)
    expect(r.falta).toBeCloseTo(r.custoMensal * 6 - 30000)
  })

  it('independência financeira pela regra dos 4%', () => {
    const ativos = [{ nome: 'CDB', tipo: 'investimento' as const, valor: 100000, rendimentoAnual: 0.1, atualizadoEm: '2026-10-01' }]
    const i = independenciaFinanceira({ ativos, custoMensal: 5000, aporteMensal: 3000 })
    expect(i.alvo).toBe(1_500_000)
    expect(i.progresso).toBeCloseTo(100000 / 1_500_000)
    expect(i.anos).toBeGreaterThan(20)
    expect(i.anos).toBeLessThan(30)
    expect(independenciaFinanceira({ ativos, custoMensal: 5000, aporteMensal: 0 }).anos).toBeNull()
    expect(independenciaFinanceira({ ativos, custoMensal: 300, aporteMensal: 0 }).anos).toBe(0)
  })
})

describe('alívio de caixa', () => {
  it('mostra quando parcelas e dívidas terminam e quanto libera', () => {
    const a = alivioDeCaixa(
      [
        lanc('2026-10', 'TV parcelada', 250, 'Compras', { data: '2026-08-01', parcela: { atual: 3, total: 5 } }),
        lanc('2026-09', 'TV parcelada', 250, 'Compras', { data: '2026-08-01', parcela: { atual: 2, total: 5 } }),
        lanc('2026-10', 'Curso', 100, 'Educação', { parcela: { atual: 10, total: 10 } }),
      ],
      [{ nome: 'Empréstimo', credor: 'X', saldo: 1000, taxaMensal: 0, parcelaMinima: 500 }],
      '2026-10',
      6,
    )
    expect(a.compras.map((c) => [c.nome, c.fim])).toEqual([
      ['Curso', '2026-10'],
      ['TV parcelada', '2026-12'],
    ])
    expect(a.porMes.map((p) => p.cartao)).toEqual([350, 250, 250, 0, 0, 0])
    expect(a.porMes.map((p) => p.dividas)).toEqual([500, 500, 0, 0, 0, 0])
    expect(a.marcos.map((m) => [m.mes, m.libera])).toEqual([
      ['2026-10', 100],
      ['2026-11', 500],
      ['2026-12', 250],
    ])
  })
})
