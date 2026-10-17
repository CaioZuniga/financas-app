import { db, salvarFinanciamento, type Lancamento, type Movimento } from '../db'
import { categorizar, categorizarMovimento } from '../engine/categorias'
import { mesAtual, somaMeses } from './format'

/** Dados fictícios para conhecer o app. Tudo pode ser apagado em Ajustes. */
export async function carregarDemo() {
  const hoje = mesAtual()
  const ini = somaMeses(hoje, -2)
  await db.cartoes.bulkPut([
    { nome: 'Nubank', limite: 12000, diaVencimento: 10 },
    { nome: 'C6', limite: 18000, diaVencimento: 15 },
  ])

  const gastos: [string, number][] = [
    ['Pão de Açúcar', 612.4],
    ['iFood *Restaurante', 89.9],
    ['Uber *Trip', 32.5],
    ['Netflix.com', 55.9],
    ['Spotify', 21.9],
    ['Drogasil', 74.3],
    ['Posto Shell', 240],
    ['Outback', 312],
    ['Amazon Marketplace', 189.9],
    ['Uber *Trip', 27.8],
    ['Carrefour', 420.15],
    ['Starbucks', 38],
    ['Sympla Ingressos', 160],
    ['Leroy Merlin', 230],
  ]
  const lancs: Lancamento[] = []
  for (let k = 0; k < 3; k++) {
    const ref = somaMeses(ini, k)
    const mesCompra = somaMeses(ref, -1)
    gastos.forEach(([d, v], i) => {
      const cartao = i % 3 === 0 ? 'C6' : 'Nubank'
      const valor = Math.round(v * (0.85 + ((i * 7 + k * 13) % 30) / 100) * 100) / 100
      lancs.push({ data: `${mesCompra}-${String(2 + i * 2).padStart(2, '0')}`, descricao: d, valor, categoria: categorizar(d), cartao, faturaRef: ref, ignorado: 0 })
    })
    lancs.push({
      data: `${somaMeses(ini, -1)}-05`,
      descricao: 'Mercadolivre*Notebook',
      valor: 420,
      categoria: 'Compras',
      cartao: 'C6',
      faturaRef: ref,
      parcela: { atual: k + 1, total: 10 },
      ignorado: 0,
    })
    lancs.push({
      data: `${mesCompra}-28`,
      descricao: 'Pagamento recebido',
      valor: -2800,
      categoria: 'Pagamentos',
      cartao: 'Nubank',
      faturaRef: ref,
      ignorado: 1,
    })
  }
  await db.lancamentos.bulkAdd(lancs)

  await db.recorrentes.bulkAdd([
    { descricao: 'Salário líquido', valor: 18500, natureza: 'entrada', inicio: somaMeses(hoje, -12), reajusteAnual: 0.05 },
    { descricao: 'Aluguel recebido (sala)', valor: 2200, natureza: 'entrada', inicio: somaMeses(hoje, -6), reajusteAnual: 0.04 },
    { descricao: 'Bônus anual', valor: 15000, natureza: 'entrada', inicio: somaMeses(hoje, 4), fim: somaMeses(hoje, 4), reajusteAnual: 0 },
    { descricao: 'Condomínio + IPTU', valor: 1450, natureza: 'saida', inicio: somaMeses(hoje, -12), reajusteAnual: 0.06 },
    { descricao: 'Escola', valor: 2900, natureza: 'saida', inicio: somaMeses(hoje, -12), reajusteAnual: 0.08 },
    { descricao: 'Plano de saúde', valor: 1280, natureza: 'saida', inicio: somaMeses(hoje, -12), reajusteAnual: 0.12 },
  ])

  await db.dividas.bulkAdd([
    { nome: 'Empréstimo pessoal', credor: 'Itaú', saldo: 14800, taxaMensal: 0.0219, parcelaMinima: 890 },
    { nome: 'Financiamento do carro', credor: 'BV', saldo: 38500, taxaMensal: 0.0149, parcelaMinima: 1620 },
  ])

  const movs: Movimento[] = []
  for (let k = 0; k < 3; k++) {
    const mes = somaMeses(ini, k)
    const itens: [string, number, string][] = [
      ['Salário Empresa X', 18500, '05'],
      ['Pix recebido Inquilino sala', 2200, '06'],
      ['Pagamento de fatura Nubank', -2800, '10'],
      ['Pagamento de fatura C6', -1900, '15'],
      ['Débito automático Escola', -2900, '08'],
      ['Boleto Condomínio', -1450, '09'],
      ['Pix enviado Feira do bairro', -180, '12'],
      ['Compra no débito Hortifruti', -240 - k * 35, '18'],
      ['Pix enviado Diarista', -600, '20'],
      ['Aplicação CDB', -3000, '25'],
      ['DARF Carnê-leão', -410, '28'],
    ]
    for (const [descricao, valor, dia] of itens)
      movs.push({ data: `${mes}-${dia}`, descricao, valor, categoria: categorizarMovimento(descricao, valor), conta: 'Itaú', ignorado: 0 })
  }
  await db.movimentos.bulkAdd(movs)

  await db.metas.bulkAdd([
    { categoria: 'Mercado', limite: 1500 },
    { categoria: 'Restaurantes', limite: 400 },
    { categoria: 'Delivery', limite: 250 },
    { categoria: 'Transporte', limite: 150 },
    { categoria: 'Compras', limite: 800 },
    { categoria: 'Lazer', limite: 200 },
  ])

  const hojeISO = new Date().toISOString().slice(0, 10)
  await db.ativos.bulkAdd([
    { nome: 'Conta Itaú', tipo: 'conta', valor: 8400, rendimentoAnual: 0, atualizadoEm: hojeISO },
    { nome: 'CDB 110% CDI', tipo: 'investimento', valor: 62000, rendimentoAnual: 0.12, atualizadoEm: hojeISO },
    { nome: 'Previdência', tipo: 'investimento', valor: 41000, rendimentoAnual: 0.1, atualizadoEm: hojeISO },
    { nome: 'Apartamento', tipo: 'imovel', valor: 820000, rendimentoAnual: 0.05, atualizadoEm: hojeISO },
    { nome: 'Carro', tipo: 'veiculo', valor: 72000, rendimentoAnual: -0.1, atualizadoEm: hojeISO },
  ])

  await salvarFinanciamento({
    valorFinanciado: 640000,
    taxaAnual: 0.1149,
    prazoMeses: 360,
    inicio: somaMeses(hoje, -30),
    trMensal: 0.0017,
    seguroMensal: 182,
    taxaAdmMensal: 25,
    amortizacoes: [],
  })
}
