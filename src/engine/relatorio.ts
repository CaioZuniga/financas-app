import { somaMeses, type Mes } from '../lib/format'
import { NAO_CONSUMO, type Categoria } from './categorias'
import { avaliarMetas, gastosDoMes, type AvaliacaoMeta, type Meta } from './orcamento'
import { valorRecorrente, type Recorrente } from './projecao'

interface LancRel {
  data: string
  descricao: string
  valor: number
  categoria: Categoria
  faturaRef: string
  cartao: string
  ignorado: 0 | 1
  parcela?: { atual: number; total: number }
}

interface MovRel {
  data: string
  descricao: string
  valor: number
  categoria: Categoria
  conta: string
  ignorado: 0 | 1
}

export interface LinhaCategoria {
  categoria: Categoria
  valor: number
  anterior: number
  /** Variação vs. mês anterior (null quando não havia gasto antes). */
  variacao: number | null
}

export interface MaiorGasto {
  data: string
  descricao: string
  valor: number
  categoria: Categoria
  origem: string
}

export interface Relatorio {
  mes: Mes
  entradas: number
  /** De onde veio o número de entradas: extrato importado ou cadastro em Fluxo. */
  fonteEntradas: 'extrato' | 'cadastro'
  gastos: number
  gastosAnterior: number
  investido: number
  sobra: number
  taxaPoupanca: number | null
  categorias: LinhaCategoria[]
  metas: AvaliacaoMeta[]
  maiores: MaiorGasto[]
  cartaoTotal: number
  cartaoParcelado: number
}

/** Junta tudo o que aconteceu num mês: entradas, consumo por categoria, metas e maiores gastos. */
export function montarRelatorio(opts: {
  mes: Mes
  lancamentos: LancRel[]
  movimentos: MovRel[]
  recorrentes: Recorrente[]
  metas: Meta[]
}): Relatorio {
  const { mes, lancamentos, movimentos } = opts
  const atual = gastosDoMes(mes, lancamentos, movimentos)
  const anterior = gastosDoMes(somaMeses(mes, -1), lancamentos, movimentos)

  const movsMes = movimentos.filter((m) => !m.ignorado && m.data.startsWith(mes))
  const receitasExtrato = movsMes.filter((m) => m.valor > 0 && m.categoria === 'Receitas').reduce((s, m) => s + m.valor, 0)
  const receitasCadastro = opts.recorrentes.filter((r) => r.natureza === 'entrada').reduce((s, r) => s + valorRecorrente(r, mes), 0)
  const fonteEntradas = receitasExtrato > 0 ? 'extrato' : 'cadastro'
  const entradas = receitasExtrato > 0 ? receitasExtrato : receitasCadastro

  const soma = (m: Map<Categoria, number>) => [...m.values()].reduce((s, v) => s + v, 0)
  const gastos = soma(atual)
  const investido = -movsMes.filter((m) => m.valor < 0 && m.categoria === 'Investimentos').reduce((s, m) => s + m.valor, 0)
  const sobra = entradas - gastos

  const categorias: LinhaCategoria[] = [...atual.entries()]
    .map(([categoria, valor]) => {
      const ant = anterior.get(categoria) ?? 0
      return { categoria, valor, anterior: ant, variacao: ant > 0 ? valor / ant - 1 : null }
    })
    .sort((a, b) => b.valor - a.valor)

  const daFatura = lancamentos.filter((l) => !l.ignorado && l.faturaRef === mes)
  const maiores: MaiorGasto[] = [
    ...daFatura.filter((l) => l.valor > 0 && !NAO_CONSUMO.includes(l.categoria)).map((l) => ({ data: l.data, descricao: l.descricao, valor: l.valor, categoria: l.categoria, origem: l.cartao })),
    ...movsMes.filter((m) => m.valor < 0 && !NAO_CONSUMO.includes(m.categoria)).map((m) => ({ data: m.data, descricao: m.descricao, valor: -m.valor, categoria: m.categoria, origem: m.conta })),
  ]
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 10)

  return {
    mes,
    entradas,
    fonteEntradas,
    gastos,
    gastosAnterior: soma(anterior),
    investido,
    sobra,
    taxaPoupanca: entradas > 0 ? sobra / entradas : null,
    categorias,
    metas: avaliarMetas(opts.metas, atual, 1),
    maiores,
    cartaoTotal: daFatura.filter((l) => l.valor > 0).reduce((s, l) => s + l.valor, 0),
    cartaoParcelado: daFatura.filter((l) => l.valor > 0 && l.parcela).reduce((s, l) => s + l.valor, 0),
  }
}
