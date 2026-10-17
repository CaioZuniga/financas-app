import { describe, expect, it } from 'vitest'
import { categorizar, chaveDescricao } from './categorias'
import { simularQuitacao } from './dividas'
import { resumir, tabelaSAC, taxaMensal, type Financiamento } from './financiamento'
import { parseFatura } from './pdf/parse'
import { gastoVariavelMedio, parcelasFuturas, projetar, valorRecorrente, type LancamentoBase } from './projecao'

const base: Financiamento = {
  valorFinanciado: 120000,
  taxaAnual: 0.12,
  prazoMeses: 120,
  inicio: '2026-01',
  trMensal: 0,
  seguroMensal: 0,
  taxaAdmMensal: 0,
  amortizacoes: [],
}

describe('SAC', () => {
  it('amortização constante sem TR e quita no prazo', () => {
    const t = tabelaSAC(base)
    expect(t).toHaveLength(120)
    expect(t[0].amortizacao).toBeCloseTo(1000, 6)
    expect(t[0].juros).toBeCloseTo(120000 * taxaMensal(0.12), 6)
    expect(t.at(-1)!.saldoFinal).toBeCloseTo(0, 4)
    expect(t[0].parcela).toBeGreaterThan(t[119].parcela)
  })

  it('TR corrige o saldo e encarece o total', () => {
    const semTR = resumir(tabelaSAC(base))
    const comTR = resumir(tabelaSAC({ ...base, trMensal: 0.002 }))
    expect(comTR.totalPago).toBeGreaterThan(semTR.totalPago)
    expect(comTR.meses).toBe(120)
  })

  it('amortização extra reduzindo prazo encurta o contrato e mantém a amortização', () => {
    const t = tabelaSAC({ ...base, amortizacoes: [{ aposParcela: 12, valor: 30000, modo: 'prazo' }] })
    expect(t.length).toBeLessThan(120)
    expect(t[20].amortizacao).toBeCloseTo(1000, 6)
    expect(t.at(-1)!.saldoFinal).toBeCloseTo(0, 4)
  })

  it('amortização extra reduzindo parcela mantém o prazo', () => {
    const t = tabelaSAC({ ...base, amortizacoes: [{ aposParcela: 12, valor: 30000, modo: 'parcela' }] })
    expect(t).toHaveLength(120)
    expect(t[20].amortizacao).toBeLessThan(1000)
  })
})

describe('dívidas', () => {
  const dividas = [
    { nome: 'Cartão', credor: 'X', saldo: 5000, taxaMensal: 0.08, parcelaMinima: 300 },
    { nome: 'Pessoal', credor: 'Y', saldo: 2000, taxaMensal: 0.02, parcelaMinima: 200 },
  ]
  it('avalanche paga menos juros que bola de neve', () => {
    const a = simularQuitacao(dividas, 1200, 'avalanche')
    const b = simularQuitacao(dividas, 1200, 'bola-de-neve')
    expect(a.totalJuros).toBeLessThanOrEqual(b.totalJuros)
    expect(b.quitacao['Pessoal']).toBeLessThan(b.quitacao['Cartão'])
  })
  it('orçamento abaixo do mínimo é inviável', () => {
    expect(simularQuitacao(dividas, 400, 'avalanche').inviavel).toBe(true)
  })
})

describe('categorias', () => {
  it('reconhece padrões e respeita regra do usuário', () => {
    expect(categorizar('UBER *TRIP')).toBe('Transporte')
    expect(categorizar('IFOOD *RESTAURANTE')).toBe('Delivery')
    expect(categorizar('Mercadolivre*Loja')).toBe('Compras')
    expect(categorizar('PADARIA X', [{ padrao: 'padaria x', categoria: 'Mercado' }])).toBe('Mercado')
    expect(chaveDescricao('MERCADOLIVRE*3PROD - Parcela 2/10')).toBe('mercadolivre prod -')
  })
})

describe('parser de fatura', () => {
  it('lê layout Nubank', () => {
    const f = parseFatura([
      'Nu Pagamentos S.A.',
      'Data de vencimento: 10 JAN 2027',
      'Total da fatura R$ 1.234,56',
      '15 DEZ •••• 4521 Uber *Trip R$ 23,90',
      '20 NOV •••• 4521 Mercadolivre*Loja - Parcela 2/3 R$ 89,90',
      '28 DEZ Pagamento recebido −R$ 500,00',
      '02 JAN Netflix.Com R$ 55,90',
    ])
    expect(f.banco).toBe('Nubank')
    expect(f.vencimento).toBe('2027-01-10')
    expect(f.total).toBeCloseTo(1234.56)
    expect(f.itens).toHaveLength(4)
    expect(f.itens[0]).toMatchObject({ data: '2026-12-15', descricao: 'Uber *Trip', valor: 23.9 })
    expect(f.itens[1].parcela).toEqual({ atual: 2, total: 3 })
    expect(f.itens[1].descricao).toBe('Mercadolivre*Loja')
    expect(f.itens[2].valor).toBe(-500)
    expect(f.itens[3].data).toBe('2027-01-02')
  })

  it('lê o PDF real do Nubank (2026): capa, NuTag, pagamento e parcelas', () => {
    // Linhas como o pdf.js monta (valores fictícios, formato calibrado com fatura real).
    const f = parseFatura([
      'Esta é a sua fatura de',
      'O Nubank declara, nos termos da Lei 12.007 2009, que os débitos',
      'outubro, no valor de',
      'R$ 1.010,00',
      'Data de vencimento: 20 OUT 2026',
      'Fatura anterior R$ 500,00',
      'Pagamento recebido −R$ 500,00',
      'Total a pagar R$ 1.010,00',
      'TRANSAÇÕES DE 13 SET A 13 OUT',
      'Fulano R$ 1.010,00',
      '13 SET •••• 1234 Ec *Mercadolivre - Parcela 2/4 R$ 100,00',
      '15 SET Transação de NuTag R$ 10,00',
      '21 SET •••• 9876 Ifd*Pizzaria Integrale R$ 50,00',
      '03 OUT •••• 1234 Dl*Uberrides R$ 850,00',
      'Pagamentos -R$ 500,00',
      '17 SET Pagamento em 17 SET −R$ 500,00',
      '3 de 6',
    ])
    expect(f.banco).toBe('Nubank')
    expect(f.total).toBe(1010)
    expect(f.itens).toHaveLength(5)
    const gastos = f.itens.filter((i) => categorizar(i.descricao) !== 'Pagamentos')
    expect(gastos.reduce((s, i) => s + i.valor, 0)).toBe(1010)
    expect(f.itens[0]).toMatchObject({ descricao: 'Ec *Mercadolivre', parcela: { atual: 2, total: 4 } })
    expect(categorizar(f.itens[1].descricao)).toBe('Transporte')
    expect(categorizar(f.itens[2].descricao)).toBe('Delivery')
    expect(f.itens[4].valor).toBe(-500)
  })

  it('lê layout C6 e DD/MM', () => {
    const f = parseFatura([
      'Banco C6 S.A.',
      'Vencimento 15/11/2026',
      '03 out AMAZON MARKETPLACE 3/6 150,00',
      '12/10 POSTO SHELL 210,35',
      'Total a pagar 360,35',
    ])
    expect(f.banco).toBe('C6')
    expect(f.itens).toHaveLength(2)
    expect(f.itens[0]).toMatchObject({ data: '2026-10-03', valor: 150, parcela: { atual: 3, total: 6 } })
    expect(f.itens[1]).toMatchObject({ data: '2026-10-12', descricao: 'POSTO SHELL' })
  })
})

describe('projeção', () => {
  const lancs: LancamentoBase[] = [
    { valor: 100, faturaRef: '2026-10', descricao: 'TV', data: '2026-08-01', parcela: { atual: 3, total: 5 }, ignorado: 0 },
    { valor: 100, faturaRef: '2026-09', descricao: 'TV', data: '2026-08-01', parcela: { atual: 2, total: 5 }, ignorado: 0 },
    { valor: 600, faturaRef: '2026-10', descricao: 'Mercado', data: '2026-10-01', ignorado: 0 },
    { valor: 300, faturaRef: '2026-09', descricao: 'Mercado', data: '2026-09-01', ignorado: 0 },
  ]
  it('parcelas futuras partem da fatura mais recente', () => {
    const p = parcelasFuturas(lancs)
    expect([...p.entries()]).toEqual([
      ['2026-11', 100],
      ['2026-12', 100],
    ])
    expect(gastoVariavelMedio(lancs)).toBe(450)
  })

  it('reajuste anual e fluxo mensal', () => {
    const r = { descricao: 'Salário', valor: 1000, natureza: 'entrada' as const, inicio: '2026-01', reajusteAnual: 0.1 }
    expect(valorRecorrente(r, '2026-12')).toBe(1000)
    expect(valorRecorrente(r, '2027-01')).toBeCloseTo(1100)
    const p = projetar({ inicio: '2026-10', meses: 3, recorrentes: [r], financiamento: [], dividas: [], lancamentos: lancs })
    expect(p[0]).toMatchObject({ cartao: 700, cartaoReal: true, saldo: 300 })
    expect(p[1].cartao).toBe(550)
    expect(p[2].acumulado).toBeCloseTo(300 + 450 + 450)
  })
})
