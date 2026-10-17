import Dexie, { type EntityTable } from 'dexie'
import type { Categoria, Regra } from './engine/categorias'
import type { Divida } from './engine/dividas'
import type { Financiamento } from './engine/financiamento'
import type { Meta } from './engine/orcamento'
import type { Ativo, Snapshot } from './engine/patrimonio'
import type { Banco } from './engine/pdf/parse'
import type { LancamentoBase, Recorrente } from './engine/projecao'

export interface Lancamento extends LancamentoBase {
  id?: number
  categoria: Categoria
  cartao: string
  importId?: number
}

/** Movimento da conta corrente (extrato). */
export interface Movimento {
  id?: number
  data: string
  descricao: string
  /** Positivo = entrada; negativo = saída. */
  valor: number
  categoria: Categoria
  conta: string
  importId?: number
  ignorado: 0 | 1
}

export interface Importacao {
  id?: number
  /** Ausente nas importações antigas (= fatura). */
  tipo?: 'fatura' | 'extrato'
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
  movimentos: EntityTable<Movimento, 'id'>
  metas: EntityTable<Meta, 'id'>
  ativos: EntityTable<Ativo, 'id'>
  snapshots: EntityTable<Snapshot, 'mes'>
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

db.version(2).stores({
  movimentos: '++id, data, conta, categoria, importId',
  metas: '++id, &categoria',
  ativos: '++id, tipo',
  snapshots: 'mes',
})

export async function lerFinanciamento(): Promise<Financiamento | null> {
  return ((await db.config.get('financiamento'))?.valor as Financiamento) ?? null
}

export const salvarFinanciamento = (f: Financiamento) => db.config.put({ chave: 'financiamento', valor: f })

const TABELAS = [
  'lancamentos',
  'importacoes',
  'cartoes',
  'recorrentes',
  'dividas',
  'regras',
  'config',
  'movimentos',
  'metas',
  'ativos',
  'snapshots',
] as const

export type Dados = Record<string, unknown[]>

export async function lerTudo(): Promise<Dados> {
  const dados: Dados = {}
  for (const t of TABELAS) dados[t] = await db.table(t).toArray()
  return dados
}

/** Substitui tudo pelos dados recebidos (backup ou nuvem), sem marcar como alteração local. */
export async function gravarTudo(dados: Dados): Promise<void> {
  gravandoDeFora = true
  try {
    await db.transaction('rw', TABELAS.map((t) => db.table(t)), async () => {
      for (const t of TABELAS) {
        await db.table(t).clear()
        await db.table(t).bulkAdd(dados[t] ?? [])
      }
    })
  } finally {
    gravandoDeFora = false
  }
}

export async function exportarBackup(): Promise<Blob> {
  const dados = await lerTudo()
  return new Blob([JSON.stringify({ app: 'financas-app', versao: 1, em: new Date().toISOString(), dados }, null, 1)], {
    type: 'application/json',
  })
}

export async function restaurarBackup(arquivo: File): Promise<void> {
  const json = JSON.parse(await arquivo.text())
  if (json.app !== 'financas-app') throw new Error('Este arquivo não é um backup do Finanças.')
  await gravarTudo(json.dados)
}

// Marca quando os dados mudaram neste aparelho (para a sincronização saber o que é mais novo).
const CHAVE_ALTERADO = 'financas:alteradoEm'
let gravandoDeFora = false
export const alteradoEm = (): number => {
  try {
    return Number(localStorage.getItem(CHAVE_ALTERADO) ?? 0)
  } catch {
    return 0
  }
}
function marcarAlterado() {
  if (gravandoDeFora) return
  try {
    localStorage.setItem(CHAVE_ALTERADO, String(Date.now()))
  } catch {
    /* sem localStorage: a sincronização só perde o aviso de conflito */
  }
}
for (const t of TABELAS) {
  // Snapshots são recalculados sozinhos; não contam como alteração do usuário.
  if (t === 'snapshots') continue
  const tabela = db.table(t)
  tabela.hook('creating', marcarAlterado)
  tabela.hook('updating', marcarAlterado)
  tabela.hook('deleting', marcarAlterado)
}
