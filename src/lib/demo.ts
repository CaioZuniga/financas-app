import { db, salvarFinanciamento, type Lancamento } from '../db'
import { categorizar } from '../engine/categorias'
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
