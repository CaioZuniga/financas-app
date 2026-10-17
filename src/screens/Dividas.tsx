import { useMemo, useState } from 'react'
import { GraficoLinha } from '../components/graficos'
import { IcLixo } from '../components/icones'
import { Botao, CabecalhoCard, Campo, Card, Kpi, Legenda, Titulo, Vazio } from '../components/ui'
import { db } from '../db'
import { simularQuitacao, type Divida } from '../engine/dividas'
import { useDados } from '../lib/dados'
import { moeda, moedaCurta, percentual, rotuloMes, somaMeses } from '../lib/format'

const NOVA: Divida = { nome: '', credor: '', saldo: 0, taxaMensal: 0.02, parcelaMinima: 0 }

export default function Dividas() {
  const d = useDados()
  const [nova, setNova] = useState<Divida>(NOVA)
  const minimo = d.dividas.reduce((s, x) => s + x.parcelaMinima, 0)
  const [extra, setExtra] = useState(500)
  const orcamento = minimo + extra

  const av = useMemo(() => simularQuitacao(d.dividas, orcamento, 'avalanche'), [d.dividas, orcamento])
  const bn = useMemo(() => simularQuitacao(d.dividas, orcamento, 'bola-de-neve'), [d.dividas, orcamento])
  const soMinimo = useMemo(() => simularQuitacao(d.dividas, minimo, 'avalanche'), [d.dividas, minimo])
  if (!d.carregado) return null

  const total = d.dividas.reduce((s, x) => s + x.saldo, 0)
  const jurosMes = d.dividas.reduce((s, x) => s + x.saldo * x.taxaMensal, 0)
  const melhor = av.totalJuros <= bn.totalJuros ? av : bn
  const n = Math.max(av.saldos.length, soMinimo.saldos.length)
  const rotulos = Array.from({ length: n }, (_, i) => rotuloMes(somaMeses(d.hoje, i + 1), true))
  const preencher = (xs: number[]) => Array.from({ length: n }, (_, i) => xs[i] ?? 0)

  async function adicionar() {
    if (!nova.nome || nova.saldo <= 0) return
    await db.dividas.add(nova)
    setNova(NOVA)
  }

  return (
    <div className="space-y-5">
      <Titulo titulo="Dívidas" sub="Empréstimos, carro, cheque especial. Compare estratégias para quitar." />

      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        <Kpi rotulo="Saldo total" valor={moedaCurta(total)} tom="rosa" />
        <Kpi rotulo="Juros por mês" valor={moeda(jurosMes)} tom="ambar" atraso={1} detalhe="o que a dívida cresce se nada for pago" />
        <Kpi rotulo="Parcelas mínimas" valor={moeda(minimo)} tom="violeta" atraso={2} />
        <Kpi
          rotulo="Livre de dívidas em"
          valor={d.dividas.length && !melhor.inviavel ? rotuloMes(somaMeses(d.hoje, melhor.meses), true) : '—'}
          tom="neon"
          atraso={3}
          detalhe={d.dividas.length ? `${melhor.meses} meses pagando ${moeda(orcamento)}/mês` : undefined}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.3fr]">
        <Card atraso={2}>
          <CabecalhoCard titulo="Suas dívidas" />
          {d.dividas.length ? (
            <ul className="space-y-2">
              {d.dividas.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3 rounded-xl border border-linha bg-white/[0.02] px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{x.nome}</div>
                    <div className="text-xs text-suave">
                      {x.credor} · {percentual(x.taxaMensal)} a.m. · mín. {moeda(x.parcelaMinima)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="num font-display font-semibold">{moeda(x.saldo)}</div>
                      {!melhor.inviavel && melhor.quitacao[x.nome] && <div className="text-[11px] text-neon">quita em {rotuloMes(somaMeses(d.hoje, melhor.quitacao[x.nome]), true)}</div>}
                    </div>
                    <button className="cursor-pointer text-apagado hover:text-rosa" onClick={() => db.dividas.delete(x.id!)}>
                      <IcLixo width={16} height={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Vazio titulo="Nenhuma dívida" texto="Ótimo! Ou cadastre abaixo para simular a quitação." />
          )}
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-linha pt-5">
            <Campo rotulo="Nome" value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} placeholder="Empréstimo pessoal" />
            <Campo rotulo="Credor" value={nova.credor} onChange={(e) => setNova({ ...nova, credor: e.target.value })} placeholder="Banco" />
            <Campo rotulo="Saldo devedor" type="number" sufixo="R$" value={nova.saldo || ''} onChange={(e) => setNova({ ...nova, saldo: Number(e.target.value) })} />
            <Campo rotulo="Juros" type="number" step="0.01" sufixo="% a.m." value={+(nova.taxaMensal * 100).toFixed(4)} onChange={(e) => setNova({ ...nova, taxaMensal: Number(e.target.value) / 100 })} />
            <Campo rotulo="Parcela mínima" type="number" sufixo="R$" value={nova.parcelaMinima || ''} onChange={(e) => setNova({ ...nova, parcelaMinima: Number(e.target.value) })} />
            <div className="flex items-end">
              <Botao variante="primario" className="w-full" onClick={adicionar} disabled={!nova.nome || nova.saldo <= 0}>
                Adicionar
              </Botao>
            </div>
          </div>
        </Card>

        <div className="min-w-0 space-y-5">
          <Card atraso={3} destaque>
            <CabecalhoCard titulo="Estratégia de quitação" sub="Quanto você consegue pagar além do mínimo?" />
            <div className="flex items-center gap-4">
              <input type="range" min={0} max={Math.max(5000, minimo * 2)} step={50} value={extra} onChange={(e) => setExtra(Number(e.target.value))} className="flex-1 accent-[var(--color-neon)]" />
              <div className="num w-28 text-right font-display text-lg font-semibold text-neon">+{moeda(extra)}</div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Estrategia nome="Avalanche" desc="Maior juro primeiro" r={av} melhor={av === melhor} />
              <Estrategia nome="Bola de neve" desc="Menor saldo primeiro" r={bn} melhor={bn === melhor && av !== melhor} />
            </div>
            {!soMinimo.inviavel && d.dividas.length > 0 && (
              <p className="mt-3 text-xs text-suave">
                Pagando só o mínimo: {soMinimo.meses} meses e {moeda(soMinimo.totalJuros)} de juros. Com +{moeda(extra)}/mês você economiza{' '}
                <b className="text-neon">{moeda(soMinimo.totalJuros - melhor.totalJuros)}</b>.
              </p>
            )}
          </Card>

          {d.dividas.length > 0 && (
            <Card atraso={4}>
              <CabecalhoCard
                titulo="Saldo devedor ao longo do tempo"
                acao={
                  <Legenda
                    itens={[
                      { cor: 'var(--color-neon)', rotulo: `Com +${moedaCurta(extra)}` },
                      { cor: 'var(--color-rosa)', rotulo: 'Só o mínimo', tracejado: true },
                    ]}
                  />
                }
              />
              <GraficoLinha
                rotulos={rotulos}
                series={[
                  { nome: `Com +${moedaCurta(extra)}`, cor: 'var(--color-neon)' },
                  { nome: 'Só o mínimo', cor: 'var(--color-rosa)', tracejado: true },
                ]}
                valores={[preencher(melhor.saldos), preencher(soMinimo.saldos)]}
                altura={220}
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function Estrategia({ nome, desc, r, melhor }: { nome: string; desc: string; r: ReturnType<typeof simularQuitacao>; melhor: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${melhor ? 'border-neon/40 bg-neon/5' : 'border-linha bg-white/[0.02]'}`}>
      <div className="flex items-center justify-between">
        <span className="font-display font-semibold">{nome}</span>
        {melhor && <span className="rounded-full bg-neon/15 px-2 py-0.5 font-mono text-[10px] text-neon">MELHOR</span>}
      </div>
      <div className="text-xs text-suave">{desc}</div>
      {r.inviavel ? (
        <div className="mt-3 text-sm text-rosa">Orçamento não cobre os juros.</div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <div className="rotulo">Prazo</div>
            <div className="num font-display text-lg font-semibold">{r.meses} m</div>
          </div>
          <div>
            <div className="rotulo">Juros</div>
            <div className="num font-display text-lg font-semibold">{moedaCurta(r.totalJuros)}</div>
          </div>
        </div>
      )}
    </div>
  )
}
