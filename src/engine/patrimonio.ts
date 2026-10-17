import { difMeses, somaMeses, type Mes } from '../lib/format'
import type { Divida } from './dividas'
import type { LinhaSAC } from './financiamento'

export type TipoAtivo = 'conta' | 'investimento' | 'imovel' | 'veiculo' | 'outro'

export const TIPOS_ATIVO: { tipo: TipoAtivo; rotulo: string }[] = [
  { tipo: 'conta', rotulo: 'Conta corrente' },
  { tipo: 'investimento', rotulo: 'Investimentos' },
  { tipo: 'imovel', rotulo: 'Imóveis' },
  { tipo: 'veiculo', rotulo: 'Veículos' },
  { tipo: 'outro', rotulo: 'Outros' },
]

export interface Ativo {
  id?: number
  nome: string
  tipo: TipoAtivo
  valor: number
  /** Rendimento (ou valorização) anual; negativo para depreciação. Ex.: 0.11 = 11% a.a. */
  rendimentoAnual: number
  /** AAAA-MM-DD da última atualização do valor. */
  atualizadoEm: string
}

export interface Snapshot {
  mes: Mes
  ativos: number
  passivos: number
  liquido: number
}

/** Saldo devedor do financiamento ao fim do mês `mes` (antes do início = valor financiado). */
export function saldoDevedorEm(tabela: LinhaSAC[], mes: Mes, valorFinanciado: number): number {
  if (!tabela.length) return 0
  const pagas = tabela.filter((l) => difMeses(l.mes, mes) >= 0)
  return pagas.length ? pagas.at(-1)!.saldoFinal : valorFinanciado
}

export function patrimonioAtual(ativos: Ativo[], saldoImovel: number, dividas: Divida[]) {
  const totalAtivos = ativos.reduce((s, a) => s + a.valor, 0)
  const totalDividas = dividas.reduce((s, d) => s + d.saldo, 0)
  const passivos = saldoImovel + totalDividas
  const porTipo = TIPOS_ATIVO.map(({ tipo, rotulo }) => ({
    tipo,
    rotulo,
    valor: ativos.filter((a) => a.tipo === tipo).reduce((s, a) => s + a.valor, 0),
  })).filter((t) => t.valor > 0)
  return { ativos: totalAtivos, passivos, liquido: totalAtivos - passivos, saldoImovel, dividas: totalDividas, porTipo }
}

/**
 * Patrimônio líquido mês a mês: ativos rendendo + sobra de caixa acumulada (vai para a conta),
 * menos o saldo devedor do imóvel e das dívidas pagando o mínimo.
 */
export function projetarPatrimonio(opts: {
  inicio: Mes
  meses: number
  ativos: Ativo[]
  tabela: LinhaSAC[]
  valorFinanciado: number
  dividas: Divida[]
  /** Caixa acumulado projetado em cada mês (mesma ordem de `meses`). */
  acumulado: number[]
}): Snapshot[] {
  const saldosDiv = opts.dividas.map((d) => d.saldo)
  const out: Snapshot[] = []
  for (let k = 0; k < opts.meses; k++) {
    const mes = somaMeses(opts.inicio, k)
    // Dívidas: juros e parcela mínima do mês k.
    opts.dividas.forEach((d, i) => {
      if (saldosDiv[i] <= 0) return
      saldosDiv[i] = Math.max(0, saldosDiv[i] * (1 + d.taxaMensal) - d.parcelaMinima)
    })
    const ativos =
      opts.ativos.reduce((s, a) => s + a.valor * Math.pow(1 + a.rendimentoAnual, (k + 1) / 12), 0) + (opts.acumulado[k] ?? 0)
    const passivos = saldoDevedorEm(opts.tabela, mes, opts.valorFinanciado) + saldosDiv.reduce((s, v) => s + v, 0)
    out.push({ mes, ativos, passivos, liquido: ativos - passivos })
  }
  return out
}
