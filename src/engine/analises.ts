import { difMeses, somaMeses, type Mes } from '../lib/format'
import { chaveDescricao, NAO_CONSUMO, type Categoria } from './categorias'
import type { Divida } from './dividas'
import type { Ativo } from './patrimonio'
import type { MesProjetado } from './projecao'

// ---------------------------------------------------------------- base comum

/** Um gasto de consumo, venha do cartão ou da conta corrente. */
export interface Gasto {
  /** Mês de referência: fatura (cartão) ou mês da data (conta). */
  mes: Mes
  data: string
  descricao: string
  /** Chave da descrição sem números/parcela, para agrupar o mesmo estabelecimento. */
  chave: string
  valor: number
  categoria: Categoria
  origem: string
  parcelado: boolean
}

interface LancIn {
  data: string
  descricao: string
  valor: number
  categoria: Categoria
  faturaRef: Mes
  cartao: string
  ignorado: 0 | 1
  parcela?: { atual: number; total: number }
}
interface MovIn {
  data: string
  descricao: string
  valor: number
  categoria: Categoria
  conta: string
  ignorado: 0 | 1
}

export function unificarGastos(lancs: LancIn[], movs: MovIn[]): Gasto[] {
  const out: Gasto[] = []
  for (const l of lancs) {
    if (l.ignorado || l.valor <= 0 || NAO_CONSUMO.includes(l.categoria)) continue
    out.push({ mes: l.faturaRef, data: l.data, descricao: l.descricao, chave: chaveDescricao(l.descricao), valor: l.valor, categoria: l.categoria, origem: l.cartao, parcelado: !!l.parcela })
  }
  for (const m of movs) {
    if (m.ignorado || m.valor >= 0 || NAO_CONSUMO.includes(m.categoria) || m.categoria === 'Transferências') continue
    out.push({ mes: m.data.slice(0, 7), data: m.data, descricao: m.descricao, chave: chaveDescricao(m.descricao), valor: -m.valor, categoria: m.categoria, origem: m.conta, parcelado: false })
  }
  return out
}

const media = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
const nomeMaisComum = (gs: Gasto[]) => {
  const c = new Map<string, number>()
  for (const g of gs) c.set(g.descricao, (c.get(g.descricao) ?? 0) + 1)
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

// ---------------------------------------------------------------- 1. assinaturas e recorrentes

export interface Recorrencia {
  nome: string
  chave: string
  categoria: Categoria
  valorMedio: number
  /** Em quantos meses distintos apareceu. */
  meses: number
  custoAnual: number
  ultimoMes: Mes
  /** Ainda aparece no mês mais recente com dados (senão, pode ter sido cancelada). */
  ativa: boolean
  /** Mesmo valor todo mês (variação ≤ 5%): cara de assinatura ou conta fixa. */
  fixo: boolean
  origem: string
}

/**
 * Gastos que se repetem: mesmo estabelecimento em pelo menos 2 meses (3 quando há 4+ meses de dados),
 * cobrado no máximo ~1 vez por mês e com valor parecido (variação ≤ 25% da média).
 * Parcelas não contam (têm fim marcado) nem compras frequentes como Uber e pedágio.
 */
export function detectarRecorrencias(gastos: Gasto[]): Recorrencia[] {
  const meses = [...new Set(gastos.map((g) => g.mes))].sort()
  const ultimo = meses.at(-1)
  const minimo = meses.length >= 4 ? 3 : 2
  const grupos = new Map<string, Gasto[]>()
  for (const g of gastos) {
    if (g.parcelado || g.chave.length < 3) continue
    grupos.set(g.chave, [...(grupos.get(g.chave) ?? []), g])
  }
  const out: Recorrencia[] = []
  for (const [chave, gs] of grupos) {
    // Valor por mês (somando se cair duas vezes no mesmo mês, ex.: pedágio).
    const porMes = new Map<Mes, number>()
    for (const g of gs) porMes.set(g.mes, (porMes.get(g.mes) ?? 0) + g.valor)
    if (porMes.size < minimo || gs.length / porMes.size > 1.5) continue
    const valores = [...porMes.values()]
    const m = media(valores)
    const desvio = Math.sqrt(media(valores.map((v) => (v - m) ** 2)))
    if (m <= 0 || desvio / m > 0.25) continue
    const ultimoMes = [...porMes.keys()].sort().at(-1)!
    out.push({
      nome: nomeMaisComum(gs),
      chave,
      categoria: gs[0].categoria,
      valorMedio: m,
      meses: porMes.size,
      custoAnual: m * 12,
      ultimoMes,
      ativa: ultimoMes === ultimo,
      fixo: desvio / m <= 0.05,
      origem: gs.at(-1)!.origem,
    })
  }
  return out.sort((a, b) => Number(b.fixo) - Number(a.fixo) || b.custoAnual - a.custoAnual)
}

// ---------------------------------------------------------------- 2. fora do padrão

export interface Desvio {
  tipo: 'categoria' | 'novo'
  rotulo: string
  categoria: Categoria
  valor: number
  /** Média dos meses anteriores (0 para estabelecimento novo). */
  referencia: number
  /** valor / referência (null para novo). */
  razao: number | null
}

/**
 * Compara o mês com a média dos até 6 meses anteriores que têm dados.
 * Categoria: alerta acima de 1,5× a média e pelo menos R$ 100 a mais.
 * Novo: estabelecimento nunca visto antes com gasto de R$ 300 ou mais no mês.
 */
export function foraDoPadrao(gastos: Gasto[], mes: Mes): Desvio[] {
  const anteriores = [...new Set(gastos.map((g) => g.mes))].filter((m) => m < mes).sort().slice(-6)
  if (!anteriores.length) return []
  const doMes = gastos.filter((g) => g.mes === mes)
  const out: Desvio[] = []

  const somaCat = (m: Mes, c: Categoria) => gastos.filter((g) => g.mes === m && g.categoria === c).reduce((s, g) => s + g.valor, 0)
  for (const c of new Set(doMes.map((g) => g.categoria))) {
    const atual = somaCat(mes, c)
    const ref = media(anteriores.map((m) => somaCat(m, c)))
    if (atual > ref * 1.5 && atual - ref >= 100)
      out.push({ tipo: 'categoria', rotulo: c, categoria: c, valor: atual, referencia: ref, razao: ref > 0 ? atual / ref : null })
  }

  const antes = gastos.filter((g) => g.mes < mes)
  const vistos = new Set(antes.map((g) => g.chave))
  // No primeiro mês importado de um cartão/conta tudo seria "novo": só vale para origens com histórico.
  const comHistorico = new Set(antes.map((g) => g.origem))
  const novos = new Map<string, Gasto[]>()
  for (const g of doMes)
    if (!vistos.has(g.chave) && !g.parcelado && comHistorico.has(g.origem)) novos.set(g.chave, [...(novos.get(g.chave) ?? []), g])
  for (const gs of novos.values()) {
    const total = gs.reduce((s, g) => s + g.valor, 0)
    if (total >= 300) out.push({ tipo: 'novo', rotulo: nomeMaisComum(gs), categoria: gs[0].categoria, valor: total, referencia: 0, razao: null })
  }
  return out.sort((a, b) => b.valor - b.referencia - (a.valor - a.referencia))
}

// ---------------------------------------------------------------- 3. mapa de calor

export interface MapaCalor {
  meses: Mes[]
  categorias: Categoria[]
  /** valores[categoria][mes] */
  valores: number[][]
  max: number
}

export function mapaCalor(gastos: Gasto[], ultimos = 12, maxCategorias = 10): MapaCalor {
  const meses = [...new Set(gastos.map((g) => g.mes))].sort().slice(-ultimos)
  const noPeriodo = gastos.filter((g) => meses.includes(g.mes))
  const totais = new Map<Categoria, number>()
  for (const g of noPeriodo) totais.set(g.categoria, (totais.get(g.categoria) ?? 0) + g.valor)
  const categorias = [...totais.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxCategorias).map(([c]) => c)
  const valores = categorias.map((c) => meses.map((m) => noPeriodo.filter((g) => g.mes === m && g.categoria === c).reduce((s, g) => s + g.valor, 0)))
  return { meses, categorias, valores, max: Math.max(0, ...valores.flat()) }
}

// ---------------------------------------------------------------- 4. onde você mais gasta

export const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const diaDaSemana = (iso: string) => new Date(iso + 'T12:00:00').getDay()

export interface Estabelecimento {
  nome: string
  categoria: Categoria
  total: number
  vezes: number
  ticketMedio: number
  /** Dia da semana mais comum (0 = domingo). */
  diaFavorito: number
}

export function rankingEstabelecimentos(gastos: Gasto[], meses: Mes[], limite = 15): Estabelecimento[] {
  const grupos = new Map<string, Gasto[]>()
  for (const g of gastos) if (meses.includes(g.mes) && g.chave.length >= 3) grupos.set(g.chave, [...(grupos.get(g.chave) ?? []), g])
  return [...grupos.values()]
    .map((gs) => {
      const dias = new Array(7).fill(0)
      for (const g of gs) dias[diaDaSemana(g.data)]++
      const total = gs.reduce((s, g) => s + g.valor, 0)
      return { nome: nomeMaisComum(gs), categoria: gs[0].categoria, total, vezes: gs.length, ticketMedio: total / gs.length, diaFavorito: dias.indexOf(Math.max(...dias)) }
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, limite)
}

/** Total gasto por dia da semana (0 = domingo), pela data da compra. */
export function gastoPorDiaDaSemana(gastos: Gasto[], meses: Mes[]): number[] {
  const dias = new Array(7).fill(0)
  for (const g of gastos) if (meses.includes(g.mes)) dias[diaDaSemana(g.data)] += g.valor
  return dias
}

// ---------------------------------------------------------------- 5. comprometimento de renda

export interface Comprometimento {
  mes: Mes
  renda: number
  imovel: number
  dividas: number
  parcelasCartao: number
  total: number
  /** total / renda (null sem renda cadastrada). */
  fracao: number | null
  nivel: 'saudavel' | 'atencao' | 'alto'
}

/**
 * Parcelas do cartão em cada mês: nas faturas já importadas, as parcelas que vieram nelas;
 * nos meses seguintes, as que ainda vão cair (a partir da última fatura em que cada compra apareceu).
 */
export function parcelasCartaoPorMes(lancs: LancIn[], futuras: Map<Mes, number>): Map<Mes, number> {
  const out = new Map<Mes, number>()
  const importados = new Set(lancs.map((l) => l.faturaRef))
  for (const l of lancs) if (l.parcela && !l.ignorado && l.valor > 0) out.set(l.faturaRef, (out.get(l.faturaRef) ?? 0) + l.valor)
  for (const [mes, v] of futuras) if (!importados.has(mes)) out.set(mes, (out.get(mes) ?? 0) + v)
  return out
}

/** Quanto da renda já está preso em parcelas: imóvel + dívidas + compras parceladas no cartão. */
export function comprometimento(projecao: MesProjetado[], parcelasCartao: Map<Mes, number>): Comprometimento[] {
  return projecao.map((p) => {
    const cartao = parcelasCartao.get(p.mes) ?? 0
    const total = p.financiamento + p.dividas + cartao
    const fracao = p.entradas > 0 ? total / p.entradas : null
    const nivel = fracao === null || fracao <= 0.3 ? 'saudavel' : fracao <= 0.4 ? 'atencao' : 'alto'
    return { mes: p.mes, renda: p.entradas, imovel: p.financiamento, dividas: p.dividas, parcelasCartao: cartao, total, fracao, nivel }
  })
}

// ---------------------------------------------------------------- 6. reserva de emergência

export interface Reserva {
  /** Dinheiro com liquidez: contas + investimentos. */
  liquido: number
  /** Saída média mensal prevista (fixas + imóvel + dívidas + cartão). */
  custoMensal: number
  meses: number
  alvoMeses: number
  falta: number
}

export function reservaEmergencia(ativos: Ativo[], projecao: MesProjetado[], alvoMeses = 6): Reserva {
  const liquido = ativos.filter((a) => a.tipo === 'conta' || a.tipo === 'investimento').reduce((s, a) => s + a.valor, 0)
  const custoMensal = media(projecao.slice(0, 6).map((p) => p.fixas + p.financiamento + p.dividas + p.cartao))
  const meses = custoMensal > 0 ? liquido / custoMensal : 0
  return { liquido, custoMensal, meses, alvoMeses, falta: Math.max(0, custoMensal * alvoMeses - liquido) }
}

// ---------------------------------------------------------------- 7. independência financeira

export interface Independencia {
  custoAnual: number
  /** Patrimônio que sustenta o custo anual com retiradas de `taxaRetirada` ao ano. */
  alvo: number
  investido: number
  progresso: number
  aporteMensal: number
  /** Anos até o alvo no ritmo atual (null se não chega em 60 anos ou não há aporte). */
  anos: number | null
}

/**
 * Regra dos 4%: precisa de 25× o custo anual investido. Projeta o patrimônio investível com retorno
 * real (acima da inflação) mensal composto e o aporte médio projetado.
 */
export function independenciaFinanceira(opts: {
  ativos: Ativo[]
  custoMensal: number
  aporteMensal: number
  retornoRealAnual?: number
  taxaRetirada?: number
}): Independencia {
  const retorno = opts.retornoRealAnual ?? 0.04
  const retirada = opts.taxaRetirada ?? 0.04
  const custoAnual = opts.custoMensal * 12
  const alvo = custoAnual / retirada
  const investido = opts.ativos.filter((a) => a.tipo === 'conta' || a.tipo === 'investimento').reduce((s, a) => s + a.valor, 0)
  const r = Math.pow(1 + retorno, 1 / 12) - 1
  let saldo = investido
  let anos: number | null = null
  if (saldo >= alvo) anos = 0
  else
    for (let m = 1; m <= 720; m++) {
      saldo = saldo * (1 + r) + Math.max(0, opts.aporteMensal)
      if (saldo >= alvo) {
        anos = m / 12
        break
      }
    }
  return { custoAnual, alvo, investido, progresso: alvo > 0 ? Math.min(1, investido / alvo) : 0, aporteMensal: opts.aporteMensal, anos }
}

// ---------------------------------------------------------------- 8. alívio de caixa futuro

export interface CompraParcelada {
  nome: string
  origem: string
  valorParcela: number
  restantes: number
  /** Mês da última parcela. */
  fim: Mes
}

export interface Alivio {
  compras: CompraParcelada[]
  /** Quanto de parcela (cartão + dívidas) cai em cada mês. */
  porMes: { mes: Mes; cartao: number; dividas: number }[]
  /** Meses em que alguma parcela termina e quanto passa a sobrar a partir do mês seguinte. */
  marcos: { mes: Mes; libera: number; itens: string[] }[]
}

export function alivioDeCaixa(lancs: LancIn[], dividas: Divida[], inicio: Mes, meses = 12): Alivio {
  // Última aparição de cada compra parcelada.
  const ultimo = new Map<string, LancIn>()
  for (const l of lancs) {
    if (!l.parcela || l.ignorado) continue
    const k = `${l.data}|${l.descricao}|${l.parcela.total}|${l.valor.toFixed(2)}`
    const a = ultimo.get(k)
    if (!a || difMeses(a.faturaRef, l.faturaRef) > 0) ultimo.set(k, l)
  }
  const compras: CompraParcelada[] = [...ultimo.values()]
    .map((l) => ({ nome: l.descricao, origem: l.cartao, valorParcela: l.valor, restantes: l.parcela!.total - l.parcela!.atual, fim: somaMeses(l.faturaRef, l.parcela!.total - l.parcela!.atual) }))
    .filter((c) => difMeses(inicio, c.fim) >= 0)
    .sort((a, b) => a.fim.localeCompare(b.fim))

  // Dívidas pagando o mínimo: mês em que cada uma termina.
  const fimDivida = dividas.map((d) => {
    let saldo = d.saldo
    let k = 0
    while (saldo > 0.005 && k < 600) {
      saldo = saldo * (1 + d.taxaMensal) - d.parcelaMinima
      k++
    }
    return { nome: d.nome, parcela: d.parcelaMinima, fim: somaMeses(inicio, k - 1) }
  })

  const porMes = Array.from({ length: meses }, (_, k) => {
    const mes = somaMeses(inicio, k)
    return {
      mes,
      cartao: compras.filter((c) => difMeses(mes, c.fim) >= 0).reduce((s, c) => s + c.valorParcela, 0),
      dividas: fimDivida.filter((d) => difMeses(mes, d.fim) >= 0).reduce((s, d) => s + d.parcela, 0),
    }
  })

  const marcosMap = new Map<Mes, { libera: number; itens: string[] }>()
  const add = (mes: Mes, valor: number, nome: string) => {
    if (difMeses(inicio, mes) < 0 || difMeses(mes, somaMeses(inicio, meses - 1)) < 0) return
    const m = marcosMap.get(mes) ?? { libera: 0, itens: [] }
    m.libera += valor
    m.itens.push(nome)
    marcosMap.set(mes, m)
  }
  for (const c of compras) add(c.fim, c.valorParcela, c.nome)
  for (const d of fimDivida) add(d.fim, d.parcela, d.nome)
  const marcos = [...marcosMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, v]) => ({ mes, ...v }))
  return { compras, porMes, marcos }
}
