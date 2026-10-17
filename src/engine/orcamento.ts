import type { Mes } from '../lib/format'
import { NAO_CONSUMO, type Categoria } from './categorias'

export interface Meta {
  id?: number
  categoria: Categoria
  /** Limite mensal em R$. */
  limite: number
}

interface GastoCartao {
  faturaRef: Mes
  categoria: Categoria
  valor: number
  ignorado: 0 | 1
}

interface GastoConta {
  data: string
  categoria: Categoria
  valor: number
  ignorado: 0 | 1
}

/**
 * Consumo do mês por categoria: cartão pela fatura do mês + saídas da conta corrente com data no mês.
 * Pagamento de fatura, investimentos e receitas não contam.
 */
export function gastosDoMes(mes: Mes, cartao: GastoCartao[], conta: GastoConta[]): Map<Categoria, number> {
  const m = new Map<Categoria, number>()
  const somar = (c: Categoria, v: number) => {
    if (NAO_CONSUMO.includes(c)) return
    m.set(c, (m.get(c) ?? 0) + v)
  }
  for (const l of cartao) if (!l.ignorado && l.faturaRef === mes) somar(l.categoria, l.valor)
  for (const l of conta) if (!l.ignorado && l.valor < 0 && l.data.startsWith(mes)) somar(l.categoria, -l.valor)
  return m
}

export type StatusMeta = 'ok' | 'atencao' | 'estourou'

export interface AvaliacaoMeta {
  categoria: Categoria
  limite: number
  gasto: number
  /** gasto / limite */
  uso: number
  /** Gasto no ritmo atual até o fim do mês. */
  projetado: number
  status: StatusMeta
}

/**
 * `fracaoDoMes` é quanto do mês já passou (0–1). Atenção quando já usou 80% ou quando o
 * ritmo atual estoura o limite antes do fim do mês.
 */
export function avaliarMetas(metas: Meta[], gastos: Map<Categoria, number>, fracaoDoMes = 1): AvaliacaoMeta[] {
  return metas
    .map((meta) => {
      const gasto = gastos.get(meta.categoria) ?? 0
      const uso = meta.limite > 0 ? gasto / meta.limite : 0
      const projetado = fracaoDoMes > 0.05 ? gasto / Math.min(1, fracaoDoMes) : gasto
      const status: StatusMeta = gasto > meta.limite ? 'estourou' : uso >= 0.8 || projetado > meta.limite ? 'atencao' : 'ok'
      return { categoria: meta.categoria, limite: meta.limite, gasto, uso, projetado, status }
    })
    .sort((a, b) => b.uso - a.uso)
}

/** Sugestão de limite: média das últimas faturas/meses com gasto, arredondada para cima em R$ 50. */
export function sugerirLimite(historico: number[]): number {
  const comGasto = historico.filter((v) => v > 0)
  if (!comGasto.length) return 0
  const media = comGasto.reduce((s, v) => s + v, 0) / comGasto.length
  return Math.ceil(media / 50) * 50
}
