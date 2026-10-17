export interface Divida {
  id?: number
  nome: string
  credor: string
  saldo: number
  /** Juros ao mês, ex.: 0.025 para 2,5% a.m. */
  taxaMensal: number
  parcelaMinima: number
}

export type Estrategia = 'avalanche' | 'bola-de-neve'

export interface ResultadoQuitacao {
  meses: number
  totalJuros: number
  /** Mês (1 = próximo) em que cada dívida fica zerada, na ordem de entrada. */
  quitacao: Record<string, number>
  /** Saldo total devedor ao fim de cada mês. */
  saldos: number[]
  inviavel: boolean
}

/**
 * Simula a quitação com um orçamento mensal fixo: paga o mínimo de todas e joga a sobra
 * na dívida prioritária (maior juro na avalanche, menor saldo na bola de neve).
 */
export function simularQuitacao(dividas: Divida[], orcamento: number, estrategia: Estrategia): ResultadoQuitacao {
  const ds = dividas.map((d) => ({ ...d }))
  const quitacao: Record<string, number> = {}
  const saldos: number[] = []
  let totalJuros = 0
  const minimoTotal = ds.reduce((s, d) => s + d.parcelaMinima, 0)
  if (ds.length === 0) return { meses: 0, totalJuros: 0, quitacao, saldos, inviavel: false }
  if (orcamento < minimoTotal) return { meses: 0, totalJuros: 0, quitacao, saldos, inviavel: true }

  for (let mes = 1; mes <= 600; mes++) {
    for (const d of ds) {
      if (d.saldo <= 0) continue
      const j = d.saldo * d.taxaMensal
      d.saldo += j
      totalJuros += j
    }
    let caixa = orcamento
    for (const d of ds) {
      if (d.saldo <= 0) continue
      const p = Math.min(d.parcelaMinima, d.saldo)
      d.saldo -= p
      caixa -= p
    }
    const ordem = ds
      .filter((d) => d.saldo > 0)
      .sort((a, b) => (estrategia === 'avalanche' ? b.taxaMensal - a.taxaMensal : a.saldo - b.saldo))
    for (const d of ordem) {
      if (caixa <= 0) break
      const p = Math.min(caixa, d.saldo)
      d.saldo -= p
      caixa -= p
    }
    for (const d of ds) if (d.saldo <= 0.005 && quitacao[d.nome] === undefined) quitacao[d.nome] = mes
    const total = ds.reduce((s, d) => s + Math.max(0, d.saldo), 0)
    saldos.push(total)
    if (total <= 0.005) return { meses: mes, totalJuros, quitacao, saldos, inviavel: false }
  }
  return { meses: 600, totalJuros, quitacao, saldos, inviavel: true }
}
