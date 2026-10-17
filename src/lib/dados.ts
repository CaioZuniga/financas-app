import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo } from 'react'
import { db, type Lancamento } from '../db'
import type { Categoria } from '../engine/categorias'
import { tabelaSAC, type Financiamento } from '../engine/financiamento'
import { patrimonioAtual, projetarPatrimonio, saldoDevedorEm } from '../engine/patrimonio'
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

export function porCategoria(lancs: Pick<Lancamento, 'categoria' | 'valor' | 'ignorado'>[]) {
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
  const movimentos = useLiveQuery(() => db.movimentos.toArray(), [])
  const metas = useLiveQuery(() => db.metas.toArray(), [])
  const ativos = useLiveQuery(() => db.ativos.toArray(), [])
  const snapshots = useLiveQuery(() => db.snapshots.orderBy('mes').toArray(), [])
  const financiamento = useLiveQuery(
    async () => ((await db.config.get('financiamento'))?.valor as Financiamento | undefined) ?? null,
    [],
  )

  const carregado = [lancamentos, recorrentes, dividas, cartoes, financiamento, movimentos, metas, ativos, snapshots].every(
    (x) => x !== undefined,
  )
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

  const saldoImovel = financiamento ? saldoDevedorEm(tabela, hoje, financiamento.valorFinanciado) : 0
  const patrimonio = useMemo(() => patrimonioAtual(ativos ?? [], saldoImovel, dividas ?? []), [ativos, saldoImovel, dividas])
  const projecaoPatrimonio = useMemo(
    () =>
      projetarPatrimonio({
        inicio: hoje,
        meses: 12,
        ativos: ativos ?? [],
        tabela,
        valorFinanciado: financiamento?.valorFinanciado ?? 0,
        dividas: dividas ?? [],
        acumulado: projecao.map((m) => m.acumulado),
      }),
    [hoje, ativos, tabela, financiamento, dividas, projecao],
  )

  return {
    carregado,
    movimentos: movimentos ?? [],
    metas: metas ?? [],
    ativos: ativos ?? [],
    snapshots: snapshots ?? [],
    patrimonio,
    projecaoPatrimonio,
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

/** Guarda a foto do patrimônio do mês para montar o histórico. */
export function useRegistrarSnapshot(d: ReturnType<typeof useDados>) {
  const { carregado, hoje, patrimonio, ativos, financiamento, snapshots } = d
  useEffect(() => {
    if (!carregado || (!ativos.length && !financiamento)) return
    const atual = snapshots.find((s) => s.mes === hoje)
    const foto = { mes: hoje, ativos: patrimonio.ativos, passivos: patrimonio.passivos, liquido: patrimonio.liquido }
    if (!atual || Math.abs(atual.liquido - foto.liquido) > 0.5 || Math.abs(atual.ativos - foto.ativos) > 0.5) db.snapshots.put(foto)
  }, [carregado, hoje, patrimonio, ativos.length, financiamento, snapshots])
}
