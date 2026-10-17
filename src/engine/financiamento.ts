import { somaMeses, type Mes } from '../lib/format'

export interface Amortizacao {
  /** Número da parcela (1 = primeira) após a qual o valor extra é abatido. */
  aposParcela: number
  valor: number
  /** Reduzir prazo mantém a amortização mensal; reduzir parcela recalcula sobre o prazo restante. */
  modo: 'prazo' | 'parcela'
}

export interface Financiamento {
  valorFinanciado: number
  /** Taxa efetiva anual, ex.: 0.1149 para 11,49% a.a. */
  taxaAnual: number
  prazoMeses: number
  /** Mês da primeira parcela. */
  inicio: Mes
  /** TR mensal estimada, ex.: 0.0017 para 0,17% a.m. */
  trMensal: number
  seguroMensal: number
  taxaAdmMensal: number
  amortizacoes: Amortizacao[]
}

export interface LinhaSAC {
  n: number
  mes: Mes
  saldoInicial: number
  correcaoTR: number
  juros: number
  amortizacao: number
  encargos: number
  parcela: number
  extra: number
  saldoFinal: number
}

export const taxaMensal = (anual: number) => Math.pow(1 + anual, 1 / 12) - 1

/**
 * Tabela SAC com correção do saldo pela TR (padrão Caixa): a cada mês o saldo é corrigido,
 * os juros incidem sobre o saldo corrigido e a amortização é o saldo corrigido dividido
 * pelas parcelas restantes.
 */
export function tabelaSAC(f: Financiamento): LinhaSAC[] {
  const i = taxaMensal(f.taxaAnual)
  const linhas: LinhaSAC[] = []
  let saldo = f.valorFinanciado
  let restantes = f.prazoMeses
  // Com "reduzir prazo" a amortização fica travada no valor anterior ao aporte.
  let amortTravada: number | null = null

  for (let n = 1; saldo > 0.005 && n <= f.prazoMeses * 2; n++) {
    const correcaoTR = saldo * f.trMensal
    const corrigido = saldo + correcaoTR
    const juros = corrigido * i
    let amortizacao: number = amortTravada !== null ? amortTravada * (1 + f.trMensal) : corrigido / restantes
    if (amortTravada !== null) amortTravada = amortizacao
    amortizacao = Math.min(amortizacao, corrigido)
    const encargos = f.seguroMensal + f.taxaAdmMensal
    let saldoFinal = corrigido - amortizacao

    const extras = f.amortizacoes.filter((a) => a.aposParcela === n)
    let extra = 0
    for (const a of extras) {
      const v = Math.min(a.valor, saldoFinal)
      extra += v
      saldoFinal -= v
      if (a.modo === 'prazo') amortTravada = amortizacao
      else amortTravada = null
    }

    linhas.push({
      n,
      mes: somaMeses(f.inicio, n - 1),
      saldoInicial: saldo,
      correcaoTR,
      juros,
      amortizacao,
      encargos,
      parcela: amortizacao + juros + encargos,
      extra,
      saldoFinal,
    })
    saldo = saldoFinal
    // Com prazo reduzido, o "restante" passa a ser quantas amortizações travadas cabem no saldo.
    restantes =
      amortTravada !== null ? Math.max(1, Math.ceil(saldo / amortTravada - 1e-9)) : Math.max(1, restantes - 1)
  }
  return linhas
}

export interface ResumoFinanciamento {
  totalPago: number
  totalJuros: number
  ultimaParcela: Mes
  meses: number
}

export function resumir(linhas: LinhaSAC[]): ResumoFinanciamento {
  return {
    totalPago: linhas.reduce((s, l) => s + l.parcela + l.extra, 0),
    totalJuros: linhas.reduce((s, l) => s + l.juros, 0),
    ultimaParcela: linhas.at(-1)?.mes ?? '',
    meses: linhas.length,
  }
}
