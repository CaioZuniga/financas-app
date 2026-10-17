import { useState } from 'react'
import { IcAlerta, IcLixo } from '../components/icones'
import { Botao, CabecalhoCard, Campo, Card, Chip, Kpi, Progresso, Selecao, Titulo, Vazio } from '../components/ui'
import { db } from '../db'
import { CATEGORIAS, NAO_CONSUMO, type Categoria } from '../engine/categorias'
import { avaliarMetas, gastosDoMes, sugerirLimite, type StatusMeta } from '../engine/orcamento'
import { corCategoria, useDados } from '../lib/dados'
import { moeda, rotuloMes, somaMeses } from '../lib/format'

const COR_STATUS: Record<StatusMeta, 'neon' | 'ambar' | 'rosa'> = { ok: 'neon', atencao: 'ambar', estourou: 'rosa' }
const ROTULO_STATUS: Record<StatusMeta, string> = { ok: 'no controle', atencao: 'atenção', estourou: 'estourou' }

export default function Metas() {
  const d = useDados()
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const [nova, setNova] = useState<{ categoria: Categoria | ''; limite: number }>({ categoria: '', limite: 0 })
  if (!d.carregado) return null

  const meses = [...new Set([...d.lancamentos.map((l) => l.faturaRef), ...d.movimentos.map((m) => m.data.slice(0, 7)), d.hoje])].sort().slice(-12)
  const mes = escolhido ?? d.hoje
  const agora = new Date()
  const fracao = mes === d.hoje ? agora.getDate() / new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate() : 1
  const gastos = gastosDoMes(mes, d.lancamentos, d.movimentos)
  const avaliacao = avaliarMetas(d.metas, gastos, fracao)
  const comMeta = new Set(d.metas.map((m) => m.categoria))

  // Média das 3 últimas referências antes do mês escolhido, por categoria.
  const historico = (c: Categoria) => [1, 2, 3].map((k) => gastosDoMes(somaMeses(mes, -k), d.lancamentos, d.movimentos).get(c) ?? 0)
  const sugestao = nova.categoria ? sugerirLimite(historico(nova.categoria)) : 0

  const limiteTotal = d.metas.reduce((s, m) => s + m.limite, 0)
  const gastoNasMetas = avaliacao.reduce((s, a) => s + a.gasto, 0)
  const estouradas = avaliacao.filter((a) => a.status === 'estourou').length
  const atencao = avaliacao.filter((a) => a.status === 'atencao').length
  const semMeta = [...gastos.entries()].filter(([c]) => !comMeta.has(c)).sort((a, b) => b[1] - a[1])
  const disponiveis = CATEGORIAS.filter((c) => !NAO_CONSUMO.includes(c) && !comMeta.has(c))

  async function adicionar() {
    if (!nova.categoria || nova.limite <= 0) return
    await db.metas.add({ categoria: nova.categoria, limite: nova.limite })
    setNova({ categoria: '', limite: 0 })
  }

  async function sugerirTodas() {
    const candidatas = CATEGORIAS.filter((c) => !NAO_CONSUMO.includes(c) && !comMeta.has(c))
      .map((c) => ({ categoria: c, limite: sugerirLimite(historico(c)) }))
      .filter((m) => m.limite >= 100)
    await db.metas.bulkAdd(candidatas)
  }

  return (
    <div className="space-y-5">
      <Titulo
        titulo="Metas e orçamento"
        sub="Limite mensal por categoria. Conta o cartão pela fatura do mês e as saídas da conta corrente."
        acao={
          d.metas.length > 0 && (
            <Botao onClick={sugerirTodas} title="Cria metas para categorias ainda sem limite, com base na média dos últimos 3 meses">
              Sugerir para o resto
            </Botao>
          )
        }
      />

      <div className="rolagem-fina flex gap-2 overflow-x-auto pb-1">
        {meses.map((m) => (
          <Chip key={m} ativo={m === mes} onClick={() => setEscolhido(m)}>
            {rotuloMes(m, true)}
          </Chip>
        ))}
      </div>

      {d.metas.length === 0 ? (
        <Card destaque>
          <Vazio
            titulo="Nenhuma meta ainda"
            texto="Crie limites por categoria. Posso sugerir valores com base na média dos seus últimos 3 meses."
            acao={
              <Botao variante="primario" onClick={sugerirTodas}>
                Sugerir metas automaticamente
              </Botao>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
            <Kpi rotulo="Orçamento" valor={moeda(limiteTotal)} tom="violeta" detalhe={`${d.metas.length} categorias`} />
            <Kpi rotulo="Gasto" valor={moeda(gastoNasMetas)} tom="ambar" atraso={1} detalhe={limiteTotal ? `${((gastoNasMetas / limiteTotal) * 100).toFixed(0)}% do orçamento` : undefined} />
            <Kpi
              rotulo="Disponível"
              valor={moeda(limiteTotal - gastoNasMetas)}
              tom={limiteTotal - gastoNasMetas >= 0 ? 'neon' : 'rosa'}
              atraso={2}
              detalhe={mes === d.hoje ? `${Math.round(fracao * 100)}% do mês já passou` : 'mês fechado'}
            />
            <Kpi
              rotulo="Alertas"
              valor={`${estouradas + atencao}`}
              tom={estouradas ? 'rosa' : atencao ? 'ambar' : 'neon'}
              atraso={3}
              detalhe={estouradas || atencao ? `${estouradas} estouradas · ${atencao} em atenção` : 'tudo no controle'}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {avaliacao.map((a, i) => {
              const meta = d.metas.find((m) => m.categoria === a.categoria)!
              return (
                <Card key={a.categoria} atraso={i + 2} className={a.status === 'estourou' ? '!border-rosa/30' : a.status === 'atencao' ? '!border-ambar/30' : ''}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: corCategoria(a.categoria) }} />
                      <span className="font-display font-semibold">{a.categoria}</span>
                    </div>
                    <span
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase ${
                        a.status === 'ok' ? 'bg-neon/10 text-neon' : a.status === 'atencao' ? 'bg-ambar/10 text-ambar' : 'bg-rosa/10 text-rosa'
                      }`}
                    >
                      {a.status !== 'ok' && <IcAlerta width={11} height={11} />}
                      {ROTULO_STATUS[a.status]}
                    </span>
                  </div>
                  <div className="mt-4 flex items-baseline justify-between gap-2">
                    <span className="num font-display text-2xl font-semibold">{moeda(a.gasto)}</span>
                    <span className="num text-sm text-suave">de {moeda(a.limite)}</span>
                  </div>
                  <div className="mt-2">
                    <Progresso valor={a.uso} cor={COR_STATUS[a.status]} />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-suave">
                    <span>{a.gasto <= a.limite ? `sobram ${moeda(a.limite - a.gasto)}` : `passou ${moeda(a.gasto - a.limite)}`}</span>
                    {mes === d.hoje && fracao < 1 && <span>no ritmo: {moeda(a.projetado)}</span>}
                  </div>
                  <div className="mt-4 flex items-end gap-2 border-t border-linha pt-3">
                    <label className="flex-1">
                      <span className="rotulo mb-1 block">Limite</span>
                      <input
                        className="campo num !py-1.5"
                        type="number"
                        defaultValue={meta.limite}
                        key={meta.limite}
                        onBlur={(e) => Number(e.target.value) > 0 && db.metas.update(meta.id!, { limite: Number(e.target.value) })}
                      />
                    </label>
                    <button className="mb-2 cursor-pointer text-apagado hover:text-rosa" onClick={() => db.metas.delete(meta.id!)} title="Remover meta">
                      <IcLixo width={16} height={16} />
                    </button>
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card atraso={4} destaque>
          <CabecalhoCard titulo="Nova meta" />
          <div className="grid grid-cols-2 items-end gap-3">
            <Selecao rotulo="Categoria" value={nova.categoria} onChange={(e) => setNova({ ...nova, categoria: e.target.value as Categoria })}>
              <option value="">Escolha…</option>
              {disponiveis.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Selecao>
            <Campo rotulo="Limite mensal" type="number" sufixo="R$" value={nova.limite || ''} onChange={(e) => setNova({ ...nova, limite: Number(e.target.value) })} />
          </div>
          {sugestao > 0 && (
            <button className="mt-2 cursor-pointer text-xs text-neon hover:underline" onClick={() => setNova({ ...nova, limite: sugestao })}>
              Usar média dos últimos 3 meses: {moeda(sugestao)}
            </button>
          )}
          <Botao variante="primario" className="mt-4 w-full" onClick={adicionar} disabled={!nova.categoria || nova.limite <= 0}>
            Criar meta
          </Botao>
        </Card>

        <Card atraso={5}>
          <CabecalhoCard titulo="Gastos sem meta" sub={`Em ${rotuloMes(mes, true)}`} />
          {semMeta.length ? (
            <ul className="divide-y divide-linha">
              {semMeta.map(([c, v]) => (
                <li key={c} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: corCategoria(c) }} />
                    {c}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="num text-suave">{moeda(v)}</span>
                    <button className="cursor-pointer font-mono text-[11px] text-neon hover:underline" onClick={() => setNova({ categoria: c, limite: sugerirLimite(historico(c)) || Math.ceil(v / 50) * 50 })}>
                      + meta
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-suave">Todos os gastos do mês estão em categorias com meta.</p>
          )}
        </Card>
      </div>
    </div>
  )
}
