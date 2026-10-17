import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarrasCategoria, GraficoBarras } from '../components/graficos'
import { IcLixo } from '../components/icones'
import { Botao, CabecalhoCard, Card, Chip, Kpi, Progresso, Selecao, Titulo, Vazio } from '../components/ui'
import { db, type Lancamento } from '../db'
import { CATEGORIAS, chaveDescricao, type Categoria } from '../engine/categorias'
import { porCategoria, useDados } from '../lib/dados'
import { moeda, rotuloData, rotuloMes } from '../lib/format'

export default function Cartao() {
  const d = useDados()
  const faturas = [...new Set(d.lancamentos.map((l) => l.faturaRef))].sort()
  const [escolhida, setEscolhida] = useState<string | null>(null)
  const [cartao, setCartao] = useState<string>('todos')
  const [categoria, setCategoria] = useState<string | null>(null)
  if (!d.carregado) return null

  if (!faturas.length)
    return (
      <div>
        <Titulo titulo="Cartão de crédito" />
        <Vazio titulo="Nenhuma fatura importada" texto="Importe os PDFs das faturas para ver gastos por categoria, parcelas e limite." acao={<Link to="/importar"><Botao variante="primario">Importar fatura</Botao></Link>} />
      </div>
    )

  const ref = escolhida ?? faturas.at(-1)!
  const nomes = [...new Set(d.lancamentos.map((l) => l.cartao))].sort()
  const daFatura = d.lancamentos.filter((l) => l.faturaRef === ref && (cartao === 'todos' || l.cartao === cartao))
  const validos = daFatura.filter((l) => !l.ignorado)
  const total = validos.reduce((s, l) => s + l.valor, 0)
  const parcelado = validos.filter((l) => l.parcela).reduce((s, l) => s + l.valor, 0)
  const limite = d.cartoes.filter((c) => cartao === 'todos' || c.nome === cartao).reduce((s, c) => s + c.limite, 0)
  const lista = daFatura
    .filter((l) => !categoria || l.categoria === categoria)
    .sort((a, b) => b.data.localeCompare(a.data))

  const historico = faturas.slice(-12)
  const porMes = (c: string) =>
    historico.map((m) => d.lancamentos.filter((l) => l.faturaRef === m && l.cartao === c && !l.ignorado).reduce((s, l) => s + l.valor, 0))

  async function recategorizar(l: Lancamento, nova: Categoria) {
    const padrao = chaveDescricao(l.descricao)
    await db.transaction('rw', db.lancamentos, db.regras, async () => {
      if (padrao.length >= 3) {
        await db.regras.where('padrao').equals(padrao).delete()
        await db.regras.add({ padrao, categoria: nova })
        // Aplica a todos os lançamentos com a mesma descrição.
        const iguais = await db.lancamentos.filter((x) => chaveDescricao(x.descricao) === padrao).primaryKeys()
        await Promise.all(iguais.map((id) => db.lancamentos.update(id, { categoria: nova })))
      } else await db.lancamentos.update(l.id!, { categoria: nova })
    })
  }

  async function apagarFatura() {
    if (!window.confirm(`Apagar a fatura de ${rotuloMes(ref, true)}${cartao !== 'todos' ? ` do ${cartao}` : ''}? Essa ação não tem volta.`)) return
    await db.lancamentos.bulkDelete(daFatura.map((l) => l.id!))
    const imps = await db.importacoes.where('faturaRef').equals(ref).toArray()
    await db.importacoes.bulkDelete(imps.filter((i) => cartao === 'todos' || i.cartao === cartao).map((i) => i.id!))
    setEscolhida(null)
  }

  return (
    <div className="space-y-5">
      <Titulo
        titulo="Cartão de crédito"
        sub={`${faturas.length} faturas · ${nomes.join(', ')}`}
        acao={
          <div className="flex gap-2">
            <Link to="/importar">
              <Botao variante="primario">Importar</Botao>
            </Link>
            <Botao variante="perigo" onClick={apagarFatura} title="Apagar fatura">
              <IcLixo width={16} height={16} />
            </Botao>
          </div>
        }
      />

      <div className="rolagem-fina flex gap-2 overflow-x-auto pb-1">
        {faturas.map((f) => (
          <Chip key={f} ativo={f === ref} onClick={() => setEscolhida(f)}>
            {rotuloMes(f, true)}
          </Chip>
        ))}
        <span className="mx-1 w-px shrink-0 bg-linha" />
        {['todos', ...nomes].map((n) => (
          <Chip key={n} ativo={n === cartao} onClick={() => setCartao(n)}>
            {n === 'todos' ? 'Todos os cartões' : n}
          </Chip>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        <Kpi rotulo="Total da fatura" valor={moeda(total)} tom="violeta" />
        <Kpi rotulo="À vista" valor={moeda(total - parcelado)} tom="neon" atraso={1} />
        <Kpi rotulo="Parcelado" valor={moeda(parcelado)} tom="ambar" atraso={2} detalhe={`${validos.filter((l) => l.parcela).length} parcelas nesta fatura`} />
        <Card atraso={3} className="!p-4">
          <span className="rotulo">Uso do limite</span>
          <div className="num mt-3 font-display text-xl font-semibold md:text-2xl">{limite ? `${((total / limite) * 100).toFixed(0)}%` : '—'}</div>
          <div className="mt-2">
            <Progresso valor={limite ? total / limite : 0} cor={limite && total / limite > 0.8 ? 'rosa' : 'violeta'} />
          </div>
          <div className="mt-1 text-xs text-suave">{limite ? `de ${moeda(limite)}` : 'defina o limite abaixo'}</div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Card atraso={2}>
          <CabecalhoCard titulo="Categorias" sub="Clique para filtrar a lista" acao={categoria && <Chip ativo onClick={() => setCategoria(null)}>{categoria} ✕</Chip>} />
          <BarrasCategoria itens={porCategoria(daFatura)} onClick={(c) => setCategoria(c === categoria ? null : c)} />
        </Card>
        <Card atraso={3}>
          <CabecalhoCard titulo="Histórico por cartão" sub="Total de cada fatura" />
          <GraficoBarras
            rotulos={historico.map((m) => rotuloMes(m))}
            series={nomes.slice(0, 4).map((n, k) => ({ nome: n, cor: ['var(--color-violeta)', 'var(--color-neon)', 'var(--color-s4)', 'var(--color-s1)'][k] }))}
            valores={nomes.slice(0, 4).map(porMes)}
            altura={260}
          />
        </Card>
      </div>

      <Card atraso={4} className="!p-0">
        <div className="p-5 pb-0">
          <CabecalhoCard titulo="Lançamentos" sub="Mudar a categoria cria uma regra: as próximas importações já vêm certas" />
        </div>
        <div className="rolagem-fina overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="rotulo text-left">
                <th className="px-5 py-2 font-normal">Data</th>
                <th className="px-3 py-2 font-normal">Descrição</th>
                <th className="px-3 py-2 font-normal">Cartão</th>
                <th className="px-3 py-2 font-normal">Categoria</th>
                <th className="px-3 py-2 text-right font-normal">Valor</th>
                <th className="px-5 py-2 text-right font-normal">Conta?</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((l) => (
                <tr key={l.id} className={`border-t border-linha transition hover:bg-white/[0.02] ${l.ignorado ? 'opacity-40' : ''}`}>
                  <td className="num px-5 py-2 whitespace-nowrap text-suave">{rotuloData(l.data)}</td>
                  <td className="px-3 py-2">
                    {l.descricao}
                    {l.parcela && <span className="ml-2 rounded-md bg-violeta/15 px-1.5 py-0.5 font-mono text-[10px] text-violeta">{l.parcela.atual}/{l.parcela.total}</span>}
                  </td>
                  <td className="px-3 py-2 text-suave">{l.cartao}</td>
                  <td className="px-3 py-2">
                    <Selecao value={l.categoria} onChange={(e) => recategorizar(l, e.target.value as Categoria)} className="min-w-36">
                      {CATEGORIAS.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </Selecao>
                  </td>
                  <td className={`num px-3 py-2 text-right whitespace-nowrap ${l.valor < 0 ? 'text-neon' : ''}`}>{moeda(l.valor)}</td>
                  <td className="px-5 py-2 text-right">
                    <input type="checkbox" className="accent-[var(--color-neon)]" checked={!l.ignorado} onChange={(e) => db.lancamentos.update(l.id!, { ignorado: e.target.checked ? 0 : 1 })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card atraso={5}>
        <CabecalhoCard titulo="Seus cartões" sub="Limite e dia de vencimento" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {d.cartoes.map((c) => (
            <div key={c.id} className="rounded-xl border border-linha bg-white/[0.02] p-4">
              <div className="font-display font-semibold">{c.nome}</div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="rotulo mb-1 block">Limite</span>
                  <input className="campo num" type="number" defaultValue={c.limite || ''} onBlur={(e) => db.cartoes.update(c.id!, { limite: Number(e.target.value) || 0 })} />
                </label>
                <label className="block">
                  <span className="rotulo mb-1 block">Vence dia</span>
                  <input className="campo num" type="number" min={1} max={31} defaultValue={c.diaVencimento} onBlur={(e) => db.cartoes.update(c.id!, { diaVencimento: Number(e.target.value) || 1 })} />
                </label>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
