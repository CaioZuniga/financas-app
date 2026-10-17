import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Botao, CabecalhoCard, Campo, Card, Selecao, Titulo } from '../components/ui'
import { IcImportar } from '../components/icones'
import { db, type Lancamento } from '../db'
import { CATEGORIAS, categorizar, type Categoria } from '../engine/categorias'
import { parseFatura, type FaturaExtraida } from '../engine/pdf/parse'
import { moeda, rotuloData, mesAtual } from '../lib/format'

interface Linha {
  incluir: boolean
  data: string
  descricao: string
  valor: number
  categoria: Categoria
  parcela?: { atual: number; total: number }
}

interface Rascunho {
  arquivo: string
  fatura: FaturaExtraida
  cartao: string
  faturaRef: string
  linhas: Linha[]
  verIgnoradas: boolean
}

export default function Importar() {
  const regras = useLiveQuery(() => db.regras.toArray(), []) ?? []
  const cartoes = useLiveQuery(() => db.cartoes.toArray(), []) ?? []
  const [rascunhos, setRascunhos] = useState<Rascunho[]>([])
  const [arrastando, setArrastando] = useState(false)
  const [lendo, setLendo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const navegar = useNavigate()

  async function ler(arquivos: FileList | File[]) {
    setErro(null)
    setLendo(true)
    const { extrairLinhas } = await import('../engine/pdf/extract')
    const novos: Rascunho[] = []
    for (const arq of Array.from(arquivos)) {
      if (!arq.name.toLowerCase().endsWith('.pdf')) continue
      try {
        const linhas = await extrairLinhas(arq, async () => window.prompt(`"${arq.name}" tem senha. Digite a senha do PDF.\nC6: os 5 primeiros dígitos do CPF.`))
        const fatura = parseFatura(linhas)
        novos.push({
          arquivo: arq.name,
          fatura,
          cartao: fatura.banco === 'Outro' ? arq.name.replace(/\.pdf$/i, '') : fatura.banco,
          faturaRef: fatura.vencimento?.slice(0, 7) ?? mesAtual(),
          verIgnoradas: false,
          linhas: fatura.itens.map((i) => {
            const categoria = categorizar(i.descricao, regras)
            return { ...i, categoria, incluir: categoria !== 'Pagamentos' }
          }),
        })
      } catch (e) {
        setErro(`Não consegui ler "${arq.name}": ${(e as Error).message}`)
      }
    }
    setRascunhos((r) => [...r, ...novos])
    setLendo(false)
  }

  function alterar(i: number, f: (r: Rascunho) => Rascunho) {
    setRascunhos((rs) => rs.map((r, k) => (k === i ? f(r) : r)))
  }

  async function salvar(i: number) {
    const r = rascunhos[i]
    const existente = await db.importacoes.where({ faturaRef: r.faturaRef, cartao: r.cartao }).first()
    if (existente && !window.confirm(`Já existe uma fatura ${r.cartao} de ${r.faturaRef}. Substituir?`)) return
    await db.transaction('rw', db.importacoes, db.lancamentos, db.cartoes, async () => {
      if (existente) {
        await db.lancamentos.where('importId').equals(existente.id!).delete()
        await db.importacoes.delete(existente.id!)
      }
      const incluidas = r.linhas.filter((l) => l.incluir)
      const importId = await db.importacoes.add({
        arquivo: r.arquivo,
        banco: r.fatura.banco,
        cartao: r.cartao,
        faturaRef: r.faturaRef,
        total: incluidas.reduce((s, l) => s + l.valor, 0),
        criadoEm: Date.now(),
      })
      // Linhas desmarcadas também entram, como ignoradas, para não sumir da conferência.
      const lancs: Lancamento[] = r.linhas.map((l) => ({
        data: l.data,
        descricao: l.descricao,
        valor: l.valor,
        categoria: l.categoria,
        parcela: l.parcela,
        cartao: r.cartao,
        faturaRef: r.faturaRef,
        importId,
        ignorado: l.incluir ? 0 : 1,
      }))
      await db.lancamentos.bulkAdd(lancs)
      if (!(await db.cartoes.where('nome').equals(r.cartao).first())) {
        await db.cartoes.add({ nome: r.cartao, limite: 0, diaVencimento: Number(r.fatura.vencimento?.slice(8, 10) ?? 10) })
      }
    })
    setRascunhos((rs) => rs.filter((_, k) => k !== i))
    if (rascunhos.length === 1) navegar('/cartao')
  }

  return (
    <div>
      <Titulo titulo="Importar faturas" sub="PDFs do Nubank, C6, Inter, XP e outros. O arquivo é lido aqui mesmo, no navegador." />

      <label
        onDragOver={(e) => {
          e.preventDefault()
          setArrastando(true)
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault()
          setArrastando(false)
          ler(e.dataTransfer.files)
        }}
        className={`entrar flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-14 text-center transition ${
          arrastando ? 'border-neon bg-neon/5' : 'border-linha-forte hover:border-neon/50 hover:bg-white/[0.02]'
        }`}
      >
        <input type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => e.target.files && ler(e.target.files)} />
        <div className="grid size-14 place-items-center rounded-2xl bg-neon/10 text-neon shadow-[0_0_30px_-8px_var(--color-neon)]">
          <IcImportar width={26} height={26} />
        </div>
        <div className="mt-4 font-display text-lg font-semibold">{lendo ? 'Lendo PDFs…' : 'Solte os PDFs aqui'}</div>
        <div className="mt-1 text-sm text-suave">ou clique para escolher. Dá para mandar várias faturas de uma vez.</div>
      </label>

      {erro && <div className="mt-4 rounded-xl border border-rosa/30 bg-rosa/10 px-4 py-3 text-sm text-rosa">{erro}</div>}

      <div className="mt-6 space-y-5">
        {rascunhos.map((r, i) => {
          const soma = r.linhas.filter((l) => l.incluir).reduce((s, l) => s + l.valor, 0)
          const confere = r.fatura.total !== undefined && Math.abs(r.fatura.total - soma) < 0.05
          return (
            <Card key={r.arquivo + i}>
              <CabecalhoCard
                titulo={r.arquivo}
                sub={`${r.fatura.banco} · ${r.linhas.length} lançamentos encontrados`}
                acao={
                  <div className="flex gap-2">
                    <Botao onClick={() => setRascunhos((rs) => rs.filter((_, k) => k !== i))}>Descartar</Botao>
                    <Botao variante="primario" onClick={() => salvar(i)} disabled={!r.linhas.length}>
                      Salvar fatura
                    </Botao>
                  </div>
                }
              />
              <div className="grid gap-3 sm:grid-cols-4">
                <label className="block">
                  <span className="rotulo mb-1.5 block">Cartão</span>
                  <input className="campo" list="cartoes" value={r.cartao} onChange={(e) => alterar(i, (x) => ({ ...x, cartao: e.target.value }))} />
                  <datalist id="cartoes">
                    {cartoes.map((c) => (
                      <option key={c.id} value={c.nome} />
                    ))}
                  </datalist>
                </label>
                <Campo rotulo="Mês da fatura" type="month" value={r.faturaRef} onChange={(e) => alterar(i, (x) => ({ ...x, faturaRef: e.target.value }))} />
                <div>
                  <span className="rotulo mb-1.5 block">Soma selecionada</span>
                  <div className="num py-2 font-display text-lg font-semibold">{moeda(soma)}</div>
                </div>
                <div>
                  <span className="rotulo mb-1.5 block">Total no PDF</span>
                  <div className={`num py-2 font-display text-lg font-semibold ${r.fatura.total === undefined ? 'text-apagado' : confere ? 'text-neon' : 'text-ambar'}`}>
                    {r.fatura.total !== undefined ? moeda(r.fatura.total) : 'não achei'}
                    {r.fatura.total !== undefined && <span className="ml-2 text-xs font-normal">{confere ? '✓ confere' : 'diferente'}</span>}
                  </div>
                </div>
              </div>

              <div className="rolagem-fina mt-4 max-h-[460px] overflow-auto rounded-xl border border-linha">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-painel-2 text-left">
                    <tr className="rotulo">
                      <th className="w-8 px-3 py-2" />
                      <th className="px-3 py-2 font-normal">Data</th>
                      <th className="px-3 py-2 font-normal">Descrição</th>
                      <th className="px-3 py-2 font-normal">Categoria</th>
                      <th className="px-3 py-2 text-right font-normal">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.linhas.map((l, k) => (
                      <tr key={k} className={`border-t border-linha ${l.incluir ? '' : 'opacity-40'}`}>
                        <td className="px-3 py-1.5">
                          <input
                            type="checkbox"
                            className="accent-[var(--color-neon)]"
                            checked={l.incluir}
                            onChange={(e) => alterar(i, (x) => ({ ...x, linhas: x.linhas.map((y, j) => (j === k ? { ...y, incluir: e.target.checked } : y)) }))}
                          />
                        </td>
                        <td className="num px-3 py-1.5 whitespace-nowrap text-suave">{rotuloData(l.data)}</td>
                        <td className="px-3 py-1.5">
                          {l.descricao}
                          {l.parcela && <span className="ml-2 rounded-md bg-violeta/15 px-1.5 py-0.5 font-mono text-[10px] text-violeta">{l.parcela.atual}/{l.parcela.total}</span>}
                        </td>
                        <td className="px-3 py-1.5">
                          <Selecao
                            value={l.categoria}
                            onChange={(e) =>
                              alterar(i, (x) => ({ ...x, linhas: x.linhas.map((y, j) => (j === k ? { ...y, categoria: e.target.value as Categoria } : y)) }))
                            }
                          >
                            {CATEGORIAS.map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </Selecao>
                        </td>
                        <td className={`num px-3 py-1.5 text-right whitespace-nowrap ${l.valor < 0 ? 'text-neon' : ''}`}>{moeda(l.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {r.fatura.ignoradas.length > 0 && (
                <div className="mt-3">
                  <button className="cursor-pointer text-xs text-suave underline-offset-2 hover:underline" onClick={() => alterar(i, (x) => ({ ...x, verIgnoradas: !x.verIgnoradas }))}>
                    {r.fatura.ignoradas.length} linhas parecidas com lançamento não foram lidas {r.verIgnoradas ? '▴' : '▾'}
                  </button>
                  {r.verIgnoradas && (
                    <pre className="rolagem-fina mt-2 max-h-48 overflow-auto rounded-xl bg-black/30 p-3 font-mono text-[11px] text-apagado">{r.fatura.ignoradas.join('\n')}</pre>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
