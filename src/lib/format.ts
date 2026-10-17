const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brlCompacto = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 2 })

export const moeda = (v: number) => brl.format(v)
export const moedaCurta = (v: number) => (Math.abs(v) >= 10000 ? brlCompacto.format(v) : brl.format(v))
export const percentual = (v: number) => pct.format(v)

export const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Mês no formato AAAA-MM. */
export type Mes = string

export function mesAtual(hoje = new Date()): Mes {
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
}

export function somaMeses(mes: Mes, n: number): Mes {
  const [a, m] = mes.split('-').map(Number)
  const total = a * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

/** Quantos meses de `de` até `ate` (positivo se `ate` é depois). */
export function difMeses(de: Mes, ate: Mes): number {
  const [a1, m1] = de.split('-').map(Number)
  const [a2, m2] = ate.split('-').map(Number)
  return (a2 - a1) * 12 + (m2 - m1)
}

export function rotuloMes(mes: Mes, comAno = false): string {
  const [a, m] = mes.split('-').map(Number)
  return comAno ? `${MESES_CURTOS[m - 1]}/${String(a).slice(2)}` : MESES_CURTOS[m - 1]
}

export function rotuloData(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d} ${MESES_CURTOS[Number(m) - 1]}`
}

/** "1.234,56" ou "-1.234,56" → número. */
export function lerValorBR(txt: string): number {
  const limpo = txt.replace(/[R$\s]/g, '').replace(/[−–]/g, '-').replace(/\./g, '').replace(',', '.')
  return Number(limpo)
}

export const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export function rotuloMesLongo(mes: Mes): string {
  const [a, m] = mes.split('-').map(Number)
  return `${MESES_LONGOS[m - 1]} de ${a}`
}
