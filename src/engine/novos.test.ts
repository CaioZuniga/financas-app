import { describe, expect, it } from 'vitest'
import { categorizarMovimento } from './categorias'
import { tabelaSAC } from './financiamento'
import { avaliarMetas, gastosDoMes, sugerirLimite } from './orcamento'
import { montarRelatorio } from './relatorio'
import { destrancar, SenhaErrada, trancar } from './cripto'
import { decidirSync } from './sync'
import { patrimonioAtual, projetarPatrimonio, saldoDevedorEm } from './patrimonio'
import { parseExtrato, pareceExtrato } from './pdf/extrato'

describe('extrato da conta', () => {
  it('distingue extrato de fatura', () => {
    expect(pareceExtrato('Extrato de conta corrente\nSaldo anterior 100,00')).toBe(true)
    expect(pareceExtrato('Data de vencimento: 10 NOV 2026\nTotal a pagar R$ 10,00')).toBe(false)
  })

  it('lê data por linha com coluna de saldo e marcas D/C', () => {
    const e = parseExtrato([
      'EXTRATO DE CONTA CORRENTE - OUTUBRO 2026',
      'Data Histórico Valor Saldo',
      '01/10 SALDO ANTERIOR 1.000,00',
      '02/10 PIX ENVIADO FULANO DE TAL -150,00 850,00',
      '03/10 SALARIO EMPRESA X 12.000,00 C 12.850,00',
      '04/10 PAGAMENTO FATURA CARTAO 2.500,00 D 10.350,00',
      '05/10 TARIFA PACOTE 39,90 10.310,10',
    ])
    expect(e.itens).toEqual([
      { data: '2026-10-02', descricao: 'PIX ENVIADO FULANO DE TAL', valor: -150 },
      { data: '2026-10-03', descricao: 'SALARIO EMPRESA X', valor: 12000 },
      { data: '2026-10-04', descricao: 'PAGAMENTO FATURA CARTAO', valor: -2500 },
      { data: '2026-10-05', descricao: 'TARIFA PACOTE', valor: -39.9 },
    ])
  })

  it('lê blocos por data com total de entradas e saídas (formato Nubank)', () => {
    const e = parseExtrato([
      'Extrato da conta',
      '05 OUT 2026 Total de entradas + 3.000,00',
      'Transferência recebida pelo Pix Fulano 3.000,00',
      'Total de saídas - 220,50',
      'Transferência enviada pelo Pix Padaria 20,50',
      'Pagamento de fatura 200,00',
      '06 OUT 2026 Total de saídas - 50,00',
      'Compra no débito Mercado 50,00',
    ])
    expect(e.itens.map((i) => [i.data, i.valor])).toEqual([
      ['2026-10-05', 3000],
      ['2026-10-05', -20.5],
      ['2026-10-05', -200],
      ['2026-10-06', -50],
    ])
  })

  it('categoriza movimentos da conta', () => {
    expect(categorizarMovimento('Pagamento de fatura', -200)).toBe('Pagamentos')
    expect(categorizarMovimento('SALARIO EMPRESA X', 12000)).toBe('Receitas')
    expect(categorizarMovimento('APLICACAO CDB', -1000)).toBe('Investimentos')
    expect(categorizarMovimento('PIX ENVIADO FULANO', -150)).toBe('Transferências')
    expect(categorizarMovimento('Compra no débito Carrefour', -50)).toBe('Mercado')
    expect(categorizarMovimento('DARF IRPF', -300)).toBe('Impostos')
  })
})

describe('orçamento', () => {
  const cartao = [
    { faturaRef: '2026-10', categoria: 'Mercado' as const, valor: 700, ignorado: 0 as const },
    { faturaRef: '2026-10', categoria: 'Restaurantes' as const, valor: 300, ignorado: 0 as const },
    { faturaRef: '2026-09', categoria: 'Mercado' as const, valor: 999, ignorado: 0 as const },
  ]
  const conta = [
    { data: '2026-10-05', categoria: 'Mercado' as const, valor: -200, ignorado: 0 as const },
    { data: '2026-10-06', categoria: 'Pagamentos' as const, valor: -1000, ignorado: 0 as const },
    { data: '2026-10-07', categoria: 'Receitas' as const, valor: 5000, ignorado: 0 as const },
  ]

  it('soma cartão do mês e saídas da conta, sem pagamento de fatura', () => {
    const g = gastosDoMes('2026-10', cartao, conta)
    expect(g.get('Mercado')).toBe(900)
    expect(g.get('Restaurantes')).toBe(300)
    expect(g.has('Pagamentos')).toBe(false)
  })

  it('classifica metas por uso e ritmo', () => {
    const g = gastosDoMes('2026-10', cartao, conta)
    const r = avaliarMetas(
      [
        { categoria: 'Mercado', limite: 800 },
        { categoria: 'Restaurantes', limite: 1000 },
        { categoria: 'Lazer', limite: 200 },
      ],
      g,
      0.5,
    )
    expect(r[0]).toMatchObject({ categoria: 'Mercado', status: 'estourou' })
    expect(r.find((x) => x.categoria === 'Restaurantes')).toMatchObject({ projetado: 600, status: 'ok' })
    expect(r.find((x) => x.categoria === 'Lazer')!.status).toBe('ok')
    expect(sugerirLimite([0, 610, 720])).toBe(700)
  })
})

describe('relatório mensal', () => {
  const lancamentos = [
    { data: '2026-09-20', descricao: 'Carrefour', valor: 500, categoria: 'Mercado' as const, faturaRef: '2026-10', cartao: 'Nubank', ignorado: 0 as const },
    { data: '2026-09-21', descricao: 'TV', valor: 300, categoria: 'Compras' as const, faturaRef: '2026-10', cartao: 'XP', ignorado: 0 as const, parcela: { atual: 2, total: 5 } },
    { data: '2026-09-28', descricao: 'Pagamento', valor: -900, categoria: 'Pagamentos' as const, faturaRef: '2026-10', cartao: 'Nubank', ignorado: 1 as const },
    { data: '2026-08-20', descricao: 'Carrefour', valor: 400, categoria: 'Mercado' as const, faturaRef: '2026-09', cartao: 'Nubank', ignorado: 0 as const },
  ]
  const movimentos = [
    { data: '2026-10-05', descricao: 'Salário', valor: 10000, categoria: 'Receitas' as const, conta: 'Itaú', ignorado: 0 as const },
    { data: '2026-10-10', descricao: 'Pagamento de fatura', valor: -800, categoria: 'Pagamentos' as const, conta: 'Itaú', ignorado: 0 as const },
    { data: '2026-10-12', descricao: 'Aplicação CDB', valor: -2000, categoria: 'Investimentos' as const, conta: 'Itaú', ignorado: 0 as const },
    { data: '2026-10-15', descricao: 'Escola', valor: -1200, categoria: 'Educação' as const, conta: 'Itaú', ignorado: 0 as const },
  ]
  const recorrentes = [{ descricao: 'Salário', valor: 9000, natureza: 'entrada' as const, inicio: '2026-01', reajusteAnual: 0 }]

  it('soma entradas do extrato, consumo sem pagamentos e compara com o mês anterior', () => {
    const r = montarRelatorio({ mes: '2026-10', lancamentos, movimentos, recorrentes, metas: [{ categoria: 'Mercado', limite: 450 }] })
    expect(r.entradas).toBe(10000)
    expect(r.fonteEntradas).toBe('extrato')
    expect(r.gastos).toBe(500 + 300 + 1200)
    expect(r.investido).toBe(2000)
    expect(r.sobra).toBe(8000)
    expect(r.taxaPoupanca).toBeCloseTo(0.8)
    expect(r.categorias[0]).toMatchObject({ categoria: 'Educação', valor: 1200, variacao: null })
    expect(r.categorias.find((c) => c.categoria === 'Mercado')!.variacao).toBeCloseTo(0.25)
    expect(r.metas[0]).toMatchObject({ categoria: 'Mercado', status: 'estourou' })
    expect(r.maiores.map((m) => m.descricao)).toEqual(['Escola', 'Carrefour', 'TV'])
    expect(r.cartaoParcelado).toBe(300)
  })

  it('sem extrato, usa as entradas cadastradas em Fluxo', () => {
    const r = montarRelatorio({ mes: '2026-09', lancamentos, movimentos, recorrentes, metas: [] })
    expect(r).toMatchObject({ entradas: 9000, fonteEntradas: 'cadastro', gastos: 400 })
  })
})

describe('backup criptografado', () => {
  it('ida e volta com a senha certa; senha errada falha sem vazar dados', async () => {
    const dados = { metas: [{ categoria: 'Mercado', limite: 1500 }], nota: 'açaí' }
    const cofre = await trancar(dados, 'senha forte 123')
    expect(cofre.dados).not.toContain('Mercado')
    expect(await destrancar(cofre, 'senha forte 123')).toEqual(dados)
    await expect(destrancar(cofre, 'outra')).rejects.toBeInstanceOf(SenhaErrada)
    const outro = await trancar(dados, 'senha forte 123')
    expect(outro.iv).not.toBe(cofre.iv)
  })
})

describe('decisão da sincronização', () => {
  const t = 1_800_000_000_000
  it('cobre os casos', () => {
    expect(decidirSync({ remotoEm: null, localAlteradoEm: t, ultimaSync: 0 })).toBe('enviar')
    expect(decidirSync({ remotoEm: t, localAlteradoEm: 0, ultimaSync: 0 })).toBe('baixar') // aparelho novo
    expect(decidirSync({ remotoEm: t, localAlteradoEm: t, ultimaSync: 0 })).toBe('conflito') // os dois têm dados
    expect(decidirSync({ remotoEm: t + 60_000, localAlteradoEm: t - 1, ultimaSync: t })).toBe('baixar')
    expect(decidirSync({ remotoEm: t + 1_000, localAlteradoEm: t + 30_000, ultimaSync: t })).toBe('enviar')
    expect(decidirSync({ remotoEm: t + 60_000, localAlteradoEm: t + 30_000, ultimaSync: t })).toBe('conflito')
    expect(decidirSync({ remotoEm: t, localAlteradoEm: t - 1, ultimaSync: t })).toBe('em-dia')
  })
})

describe('patrimônio', () => {
  const tabela = tabelaSAC({
    valorFinanciado: 120000,
    taxaAnual: 0.12,
    prazoMeses: 120,
    inicio: '2026-01',
    trMensal: 0,
    seguroMensal: 0,
    taxaAdmMensal: 0,
    amortizacoes: [],
  })

  it('saldo devedor e patrimônio líquido', () => {
    expect(saldoDevedorEm(tabela, '2025-12', 120000)).toBe(120000)
    expect(saldoDevedorEm(tabela, '2026-10', 120000)).toBeCloseTo(110000, 4)
    const p = patrimonioAtual(
      [
        { nome: 'Apto', tipo: 'imovel', valor: 300000, rendimentoAnual: 0, atualizadoEm: '2026-10-01' },
        { nome: 'CDB', tipo: 'investimento', valor: 20000, rendimentoAnual: 0.12, atualizadoEm: '2026-10-01' },
      ],
      110000,
      [{ nome: 'Carro', credor: 'X', saldo: 10000, taxaMensal: 0.01, parcelaMinima: 500 }],
    )
    expect(p.liquido).toBe(200000)
    expect(p.porTipo.map((t) => t.tipo)).toEqual(['investimento', 'imovel'])
  })

  it('projeção soma rendimento e caixa e abate passivos', () => {
    const s = projetarPatrimonio({
      inicio: '2026-10',
      meses: 12,
      ativos: [{ nome: 'CDB', tipo: 'investimento', valor: 10000, rendimentoAnual: 0.1, atualizadoEm: '2026-10-01' }],
      tabela,
      valorFinanciado: 120000,
      dividas: [],
      acumulado: Array.from({ length: 12 }, (_, k) => (k + 1) * 1000),
    })
    expect(s[11].ativos).toBeCloseTo(11000 + 12000, 4)
    expect(s[11].passivos).toBeCloseTo(99000, 4) // set/27 = 21ª parcela paga
    expect(s[11].liquido).toBeGreaterThan(s[0].liquido)
  })
})
