import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IcImportar } from '../components/icones'
import { Botao, CabecalhoCard, Campo, Card, Chip, Selecao, Titulo } from '../components/ui'
import { db, type Lancamento, type Movimento } from '../db'
import { CATEGORIAS, categorizar, categorizarMovimento, type Categoria, type Regra } from '../engine/categorias'
import { pareceExtrato, parseExtrato } from '../engine/pdf/extrato'
import { parseFatura, type Banco } from '../engine/pdf/parse'
import { mesAtual, moeda, rotuloData } from '../lib/format'

type Tipo = 'fatura' | 'extrato'

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
  texto: string[]
  tipo: Tipo
  banco: Banco
  /** Nome do cartão (fatura) ou da conta (extrato). */
  origem: string
  faturaRef: string
  totalPdf?: number
  linhas: Linha[]
  ignoradas: string[]
  verIgnoradas: boolean
}

function montar(arquivo: string, texto: string[], tipo: Tipo, regras: Regra[]): Rascunho {
  if (tipo === 'extrato') {
    const e = parseExtrato(texto)
    return {
      arquivo,
      texto,
      tipo,
      banco: e.banco,
      origem: e.banco === 'Outro' ? arquivo.replace(/\.pdf$/i, '') : e.banco,
      faturaRef: mesAtual(),
      linhas: e.itens.map((i) => ({ ...i, categoria: categorizarMovimento(i.descricao, i.valor, regras), incluir: true })),
      ignoradas: e.ignoradas,
      verIgnoradas: false,
    }
  }
  const f = parseFatura(texto)
  return {
    arquivo,
    texto,
    tipo,
    banco: f.banco,
    origem: f.banco === 'Outro' ? arquivo.replace(/\.pdf$/i, '') : f.banco,
    faturaRef: f.vencimento?.slice(0, 7) ?? mesAtual(),
    totalPdf: f.total,
    linhas: f.itens.map((i) => {
      const categoria = categorizar(i.descricao, regras)
      return { ...i, categoria, incluir: categoria !== 'Pagamentos' }
    }),
    ignoradas: f.ignoradas,
    verIgnoradas: false,
  }
}

export default function Importar() {
  const regras = useLiveQuery(() => db.regras.toArray(), []) ?? []
  const cartoes = useLiveQuery(() => db.cartoes.toArray(), []) ?? []
  const contas = useLiveQuery(async () => [...new Set((await db.movimentos.toArray()).map((m) => m.conta))], []) ?? []
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
        const texto = await extrairLinhas(arq, async () => window.prompt(`"${arq.name}" tem senha. Digite a senha do PDF.\nC6: os 5 primeiros dígitos do CPF.`))
        novos.push(montar(arq.name, texto, pareceExtrato(texto.join('\n')) ? 'extrato' : 'fatura', regras))
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

  async function salvarFatura(r: Rascunho) {
    const existente = await db.importacoes.where({ faturaRef: r.faturaRef, cartao: r.origem }).filter((i) => i.tipo !== 'extrato').first()
    if (existente && !window.confirm(`Já existe uma fatura ${r.origem} de ${r.faturaRef}. Substituir?`)) return false
    await db.transaction('rw', db.importacoes, db.lancamentos, db.cartoes, async () => {
      if (existente) {
        await db.lancamentos.where('importId').equals(existente.id!).delete()
        await db.importacoes.delete(existente.id!)
      }
      const importId = await db.importacoes.add({
        tipo: 'fatura',
        arquivo: r.arquivo,
        banco: r.banco,
        cartao: r.origem,
        faturaRef: r.faturaRef,
        total: r.linhas.filter((l) => l.incluir).reduce((s, l) => s + l.valor, 0),
        criadoEm: Date.now(),
      })
      // Linhas desmarcadas também entram, como ignoradas, para não sumir da conferência.
      const lancs: Lancamento[] = r.linhas.map((l) => ({
        data: l.data,
        descricao: l.descricao,
        valor: l.valor,
        categoria: l.categoria,
        parcela: l.parcela,
        cartao: r.origem,
        faturaRef: r.faturaRef,
        importId,
        ignorado: l.incluir ? 0 : 1,
      }))
      await db.lancamentos.bulkAdd(lancs)
      if (!(await db.cartoes.where('nome').equals(r.origem).first())) await db.cartoes.add({ nome: r.origem, limite: 0, diaVencimento: 10 })
    })
    return true
  }

  async function salvarExtrato(r: Rascunho) {
    // Extratos se sobrepõem: pula movimentos idênticos (data, descrição, valor) já salvos nessa conta.
    const existentes = await db.movimentos.where('conta').equals(r.origem).toArray()
    const chave = (m: { data: string; descricao: string; valor: number }) => `${m.data}|${m.descricao}|${m.valor.toFixed(2)}`
    const ja = new Set(existentes.map(chave))
    const novos = r.linhas.filter((l) => !ja.has(chave(l)))
    const pulados = r.linhas.length - novos.length
    await db.transaction('rw', db.importacoes, db.movimentos, async () => {
      const importId = await db.importacoes.add({
        tipo: 'extrato',
        arquivo: r.arquivo,
        banco: r.banco,
        cartao: r.origem,
        faturaRef: r.linhas[0]?.data.slice(0, 7) ?? mesAtual(),
        total: novos.reduce((s, l) => s + l.valor, 0),
        criadoEm: Date.now(),
      })
      const movs: Movimento[] = novos.map((l) => ({
        data: l.data,
        descricao: l.descricao,
        valor: l.valor,
        categoria: l.categoria,
        conta: r.origem,
        importId,
        ignorado: l.incluir ? 0 : 1,
      }))
      await db.movimentos.bulkAdd(movs)
    })
    if (pulados) window.alert(`${pulados} movimentos já estavam salvos e foram pulados.`)
    return true
  }

  async function salvar(i: number) {
    const r = rascunhos[i]
    const ok = r.tipo === 'extrato' ? await salvarExtrato(r) : await salvarFatura(r)
    if (!ok) return
    setRascunhos((rs) => rs.filter((_, k) => k !== i))
    if (rascunhos.length === 1) navegar(r.tipo === 'extrato' ? '/conta' : '/cartao')
  }

  return (
    <div>
      <Titulo titulo="Importar PDFs" sub="Faturas de cartão e extratos de conta. O arquivo é lido aqui mesmo, no navegador." />

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
        <div className="mt-1 text-sm text-suave">Fatura ou extrato: o app reconhece sozinho. Dá para mandar vários de uma vez.</div>
      </label>

      {erro && <div className="mt-4 rounded-xl border border-rosa/30 bg-rosa/10 px-4 py-3 text-sm text-rosa">{erro}</div>}

      <div className="mt-6 space-y-5">
        {rascunhos.map((r, i) => {
          const incluidas = r.linhas.filter((l) => l.incluir)
          const soma = incluidas.reduce((s, l) => s + l.valor, 0)
          const confere = r.totalPdf !== undefined && Math.abs(r.totalPdf - soma) < 0.05
          const entradas = incluidas.filter((l) => l.valor > 0).reduce((s, l) => s + l.valor, 0)
          const nomes = r.tipo === 'extrato' ? contas : cartoes.map((c) => c.nome)
          return (
            <Card key={r.arquivo + i}>
              <CabecalhoCard
                titulo={r.arquivo}
                sub={`${r.banco} · ${r.linhas.length} ${r.tipo === 'extrato' ? 'movimentos' : 'lançamentos'} encontrados`}
                acao={
                  <div className="flex gap-2">
                    <Botao onClick={() => setRascunhos((rs) => rs.filter((_, k) => k !== i))}>Descartar</Botao>
                    <Botao variante="primario" onClick={() => salvar(i)} disabled={!r.linhas.length}>
                      Salvar {r.tipo}
                    </Botao>
                  </div>
                }
              />
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rotulo mr-1">Este PDF é</span>
                {(['fatura', 'extrato'] as Tipo[]).map((t) => (
                  <Chip key={t} ativo={r.tipo === t} onClick={() => r.tipo !== t && alterar(i, (x) => montar(x.arquivo, x.texto, t, regras))}>
                    {t === 'fatura' ? 'Fatura do cartão' : 'Extrato da conta'}
                  </Chip>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <label className="block">
                  <span className="rotulo mb-1.5 block">{r.tipo === 'extrato' ? 'Conta' : 'Cartão'}</span>
                  <input className="campo" list={`origens-${i}`} value={r.origem} onChange={(e) => alterar(i, (x) => ({ ...x, origem: e.target.value }))} />
                  <datalist id={`origens-${i}`}>
                    {nomes.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </label>
                {r.tipo === 'fatura' ? (
                  <>
                    <Campo rotulo="Mês da fatura" type="month" value={r.faturaRef} onChange={(e) => alterar(i, (x) => ({ ...x, faturaRef: e.target.value }))} />
                    <div>
                      <span className="rotulo mb-1.5 block">Soma selecionada</span>
                      <div className="num py-2 font-display text-lg font-semibold">{moeda(soma)}</div>
                    </div>
                    <div>
                      <span className="rotulo mb-1.5 block">Total no PDF</span>
                      <div className={`num py-2 font-display text-lg font-semibold ${r.totalPdf === undefined ? 'text-apagado' : confere ? 'text-neon' : 'text-ambar'}`}>
                        {r.totalPdf !== undefined ? moeda(r.totalPdf) : 'não achei'}
                        {r.totalPdf !== undefined && <span className="ml-2 text-xs font-normal">{confere ? '✓ confere' : 'diferente'}</span>}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="rotulo mb-1.5 block">Período</span>
                      <div className="num py-2 text-sm">
                        {r.linhas.length ? `${rotuloData(r.linhas.map((l) => l.data).sort()[0])} a ${rotuloData(r.linhas.map((l) => l.data).sort().at(-1)!)}` : '—'}
                      </div>
                    </div>
                    <div>
                      <span className="rotulo mb-1.5 block">Entradas</span>
                      <div className="num py-2 font-display text-lg font-semibold text-neon">{moeda(entradas)}</div>
                    </div>
                    <div>
                      <span className="rotulo mb-1.5 block">Saídas</span>
                      <div className="num py-2 font-display text-lg font-semibold text-violeta">{moeda(entradas - soma)}</div>
                    </div>
                  </>
                )}
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
                        <td className={`num px-3 py-1.5 text-right whitespace-nowrap ${(r.tipo === 'extrato' ? l.valor > 0 : l.valor < 0) ? 'text-neon' : ''}`}>{moeda(l.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {r.ignoradas.length > 0 && (
                <div className="mt-3">
                  <button className="cursor-pointer text-xs text-suave underline-offset-2 hover:underline" onClick={() => alterar(i, (x) => ({ ...x, verIgnoradas: !x.verIgnoradas }))}>
                    {r.ignoradas.length} linhas parecidas com lançamento não foram lidas {r.verIgnoradas ? '▴' : '▾'}
                  </button>
                  {r.verIgnoradas && (
                    <pre className="rolagem-fina mt-2 max-h-48 overflow-auto rounded-xl bg-black/30 p-3 font-mono text-[11px] text-apagado">{r.ignoradas.join('\n')}</pre>
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
