import { difMeses, somaMeses, type Mes } from '../lib/format'
import type { Divida } from './dividas'
import type { LinhaSAC } from './financiamento'

export interface Recorrente {
  id?: number
  descricao: string
  valor: number
  natureza: 'entrada' | 'saida'
  /** Primeiro mês (AAAA-MM). */
  inicio: Mes
  /** Último mês, inclusive; vazio = sem fim. */
  fim?: Mes
  /** Reajuste anual aplicado a cada 12 meses desde o início, ex.: 0.05. */
  reajusteAnual: number
}

export interface LancamentoBase {
  valor: number
  faturaRef: Mes
  descricao: string
  data: string
  parcela?: { atual: number; total: number }
  ignorado: 0 | 1
}

export interface MesProjetado {
  mes: Mes
  entradas: number
  fixas: number
  financiamento: number
  dividas: number
  cartao: number
  /** Fatura já importada (valor real) em vez de estimativa. */
  cartaoReal: boolean
  saldo: number
  acumulado: number
}

export function valorRecorrente(r: Recorrente, mes: Mes): number {
  if (difMeses(r.inicio, mes) < 0) return 0
  if (r.fim && difMeses(mes, r.fim) < 0) return 0
  const anos = Math.floor(difMeses(r.inicio, mes) / 12)
  return r.valor * Math.pow(1 + r.reajusteAnual, anos)
}

/** Soma das faturas por mês de referência (só gastos válidos). */
export function totaisPorFatura(lancs: LancamentoBase[]): Map<Mes, number> {
  const m = new Map<Mes, number>()
  for (const l of lancs) if (!l.ignorado) m.set(l.faturaRef, (m.get(l.faturaRef) ?? 0) + l.valor)
  return m
}

/** Parcelas ainda por vir, a partir da fatura mais recente em que cada compra parcelada apareceu. */
export function parcelasFuturas(lancs: LancamentoBase[]): Map<Mes, number> {
  const ultimo = new Map<string, LancamentoBase>()
  for (const l of lancs) {
    if (!l.parcela || l.ignorado) continue
    const chave = `${l.data}|${l.descricao}|${l.parcela.total}|${l.valor.toFixed(2)}`
    const atual = ultimo.get(chave)
    if (!atual || difMeses(atual.faturaRef, l.faturaRef) > 0) ultimo.set(chave, l)
  }
  const porMes = new Map<Mes, number>()
  for (const l of ultimo.values()) {
    const restantes = l.parcela!.total - l.parcela!.atual
    for (let k = 1; k <= restantes; k++) {
      const mes = somaMeses(l.faturaRef, k)
      porMes.set(mes, (porMes.get(mes) ?? 0) + l.valor)
    }
  }
  return porMes
}

/** Média do gasto à vista (sem parcelados) nas últimas `n` faturas importadas. */
export function gastoVariavelMedio(lancs: LancamentoBase[], n = 3): number {
  const porFatura = new Map<Mes, number>()
  for (const l of lancs) {
    if (l.ignorado || l.parcela || l.valor <= 0) continue
    porFatura.set(l.faturaRef, (porFatura.get(l.faturaRef) ?? 0) + l.valor)
  }
  const ultimas = [...porFatura.keys()].sort().slice(-n)
  if (ultimas.length === 0) return 0
  return ultimas.reduce((s, m) => s + porFatura.get(m)!, 0) / ultimas.length
}

/** Parcela mínima de cada dívida enquanto ela não é quitada só com o mínimo. */
function parcelasDividas(dividas: Divida[], meses: number): number[] {
  const out = new Array(meses).fill(0)
  for (const d of dividas) {
    let saldo = d.saldo
    for (let k = 0; k < meses && saldo > 0.005; k++) {
      saldo *= 1 + d.taxaMensal
      const p = Math.min(d.parcelaMinima, saldo)
      saldo -= p
      out[k] += p
    }
  }
  return out
}

export function projetar(opts: {
  inicio: Mes
  meses: number
  recorrentes: Recorrente[]
  financiamento: LinhaSAC[]
  dividas: Divida[]
  lancamentos: LancamentoBase[]
  saldoInicial?: number
}): MesProjetado[] {
  const reais = totaisPorFatura(opts.lancamentos)
  const futuras = parcelasFuturas(opts.lancamentos)
  const variavel = gastoVariavelMedio(opts.lancamentos)
  const pDiv = parcelasDividas(opts.dividas, opts.meses)
  const out: MesProjetado[] = []
  let acumulado = opts.saldoInicial ?? 0

  for (let k = 0; k < opts.meses; k++) {
    const mes = somaMeses(opts.inicio, k)
    const entradas = opts.recorrentes.filter((r) => r.natureza === 'entrada').reduce((s, r) => s + valorRecorrente(r, mes), 0)
    const fixas = opts.recorrentes.filter((r) => r.natureza === 'saida').reduce((s, r) => s + valorRecorrente(r, mes), 0)
    const financiamento = opts.financiamento.find((l) => l.mes === mes)?.parcela ?? 0
    const cartaoReal = reais.has(mes)
    const cartao = cartaoReal ? reais.get(mes)! : (futuras.get(mes) ?? 0) + variavel
    const saldo = entradas - fixas - financiamento - pDiv[k] - cartao
    acumulado += saldo
    out.push({ mes, entradas, fixas, financiamento, dividas: pDiv[k], cartao, cartaoReal, saldo, acumulado })
  }
  return out
}
