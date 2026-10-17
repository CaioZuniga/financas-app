import Dexie, { type EntityTable } from 'dexie'
import type { Categoria, Regra } from './engine/categorias'
import type { Divida } from './engine/dividas'
import type { Financiamento } from './engine/financiamento'
import type { Banco } from './engine/pdf/parse'
import type { LancamentoBase, Recorrente } from './engine/projecao'

export interface Lancamento extends LancamentoBase {
  id?: number
  categoria: Categoria
  cartao: string
  importId?: number
}

export interface Importacao {
  id?: number
  arquivo: string
  banco: Banco
  cartao: string
  faturaRef: string
  total: number
  criadoEm: number
}

export interface Cartao {
  id?: number
  nome: string
  limite: number
  diaVencimento: number
}

export interface Config {
  chave: string
  valor: unknown
}

export const db = new Dexie('financas') as Dexie & {
  lancamentos: EntityTable<Lancamento, 'id'>
  importacoes: EntityTable<Importacao, 'id'>
  cartoes: EntityTable<Cartao, 'id'>
  recorrentes: EntityTable<Recorrente, 'id'>
  dividas: EntityTable<Divida, 'id'>
  regras: EntityTable<Regra, 'id'>
  config: EntityTable<Config, 'chave'>
}

db.version(1).stores({
  lancamentos: '++id, faturaRef, cartao, categoria, importId, data',
  importacoes: '++id, faturaRef, cartao',
  cartoes: '++id, &nome',
  recorrentes: '++id, natureza',
  dividas: '++id',
  regras: '++id, &padrao',
  config: 'chave',
})

export async function lerFinanciamento(): Promise<Financiamento | null> {
  return ((await db.config.get('financiamento'))?.valor as Financiamento) ?? null
}

export const salvarFinanciamento = (f: Financiamento) => db.config.put({ chave: 'financiamento', valor: f })

const TABELAS = ['lancamentos', 'importacoes', 'cartoes', 'recorrentes', 'dividas', 'regras', 'config'] as const

export async function exportarBackup(): Promise<Blob> {
  const dados: Record<string, unknown[]> = {}
  for (const t of TABELAS) dados[t] = await db.table(t).toArray()
  return new Blob([JSON.stringify({ app: 'financas-app', versao: 1, em: new Date().toISOString(), dados }, null, 1)], {
    type: 'application/json',
  })
}

export async function restaurarBackup(arquivo: File): Promise<void> {
  const json = JSON.parse(await arquivo.text())
  if (json.app !== 'financas-app') throw new Error('Este arquivo não é um backup do Finanças.')
  await db.transaction('rw', TABELAS.map((t) => db.table(t)), async () => {
    for (const t of TABELAS) {
      await db.table(t).clear()
      await db.table(t).bulkAdd(json.dados[t] ?? [])
    }
  })
}
