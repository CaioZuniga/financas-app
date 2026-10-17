import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, type Lancamento } from '../db'
import type { Categoria } from '../engine/categorias'
import { tabelaSAC, type Financiamento } from '../engine/financiamento'
import { projetar } from '../engine/projecao'
import { mesAtual } from './format'

/** Cor fixa por categoria (a cor segue a categoria, nunca a posição no ranking). */
const COR_CATEGORIA: Partial<Record<Categoria, string>> = {
  Mercado: 'var(--color-s1)',
  Restaurantes: 'var(--color-s2)',
  Transporte: 'var(--color-s3)',
  Compras: 'var(--color-s4)',
  Delivery: 'var(--color-s5)',
  Saúde: 'var(--color-s6)',
  Assinaturas: 'var(--color-s7)',
  Casa: 'var(--color-s8)',
}
export const corCategoria = (c: string) => COR_CATEGORIA[c as Categoria] ?? '#6b7180'

export function porCategoria(lancs: Lancamento[]) {
  const m = new Map<string, number>()
  for (const l of lancs) if (!l.ignorado && l.valor > 0) m.set(l.categoria, (m.get(l.categoria) ?? 0) + l.valor)
  return [...m.entries()]
    .map(([rotulo, valor]) => ({ rotulo, valor, cor: corCategoria(rotulo) }))
    .sort((a, b) => b.valor - a.valor)
}

export function useDados() {
  const lancamentos = useLiveQuery(() => db.lancamentos.toArray(), [])
  const recorrentes = useLiveQuery(() => db.recorrentes.toArray(), [])
  const dividas = useLiveQuery(() => db.dividas.toArray(), [])
  const cartoes = useLiveQuery(() => db.cartoes.toArray(), [])
  const financiamento = useLiveQuery(
    async () => ((await db.config.get('financiamento'))?.valor as Financiamento | undefined) ?? null,
    [],
  )

  const carregado = [lancamentos, recorrentes, dividas, cartoes, financiamento].every((x) => x !== undefined)
  const tabela = useMemo(() => (financiamento ? tabelaSAC(financiamento) : []), [financiamento])
  const hoje = mesAtual()

  const projecao = useMemo(
    () =>
      projetar({
        inicio: hoje,
        meses: 12,
        recorrentes: recorrentes ?? [],
        financiamento: tabela,
        dividas: dividas ?? [],
        lancamentos: lancamentos ?? [],
      }),
    [hoje, recorrentes, tabela, dividas, lancamentos],
  )

  return {
    carregado,
    hoje,
    lancamentos: lancamentos ?? [],
    recorrentes: recorrentes ?? [],
    dividas: dividas ?? [],
    cartoes: cartoes ?? [],
    financiamento: financiamento ?? null,
    tabela,
    projecao,
  }
}
