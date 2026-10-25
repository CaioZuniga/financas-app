import { useMemo, useState } from 'react'
import { GraficoBarras } from '../components/graficos'
import { IcAlerta } from '../components/icones'
import { CabecalhoCard, Campo, Card, Chip, Kpi, Legenda, Progresso, Titulo, Vazio } from '../components/ui'
import {
  alivioDeCaixa,
  comprometimento,
  DIAS_SEMANA,
  detectarRecorrencias,
  foraDoPadrao,
  gastoPorDiaDaSemana,
  independenciaFinanceira,
  mapaCalor,
  parcelasCartaoPorMes,
  rankingEstabelecimentos,
  reservaEmergencia,
  unificarGastos,
} from '../engine/analises'
import { parcelasFuturas } from '../engine/projecao'
import { corCategoria, useDados } from '../lib/dados'
import { moeda, moedaCurta, percentual, rotuloMes, somaMeses } from '../lib/format'

type Aba = 'gastos' | 'planejamento' | 'parcelas'
const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

export default function Analises() {
  const d = useDados()
  const [aba, setAba] = useState<Aba>('gastos')
  const gastos = useMemo(() => unificarGastos(d.lancamentos, d.movimentos), [d.lancamentos, d.movimentos])
  if (!d.carregado) return null

  return (
    <div className="space-y-5">
      <Titulo titulo="Análises" sub="O que os seus números dizem: padrões, riscos e folgas que vêm aí." />
      <div className="flex gap-2">
        <Chip ativo={aba === 'gastos'} onClick={() => setAba('gastos')}>
          Gastos
        </Chip>
        <Chip ativo={aba === 'planejamento'} onClick={() => setAba('planejamento')}>
          Planejamento
        </Chip>
        <Chip ativo={aba === 'parcelas'} onClick={() => setAba('parcelas')}>
          Parcelas e alívio
        </Chip>
      </div>
      {aba === 'gastos' && <AbaGastos gastos={gastos} />}
      {aba === 'planejamento' && <AbaPlanejamento d={d} />}
      {aba === 'parcelas' && <AbaParcelas d={d} />}
    </div>
  )
}

// ------------------------------------------------------------------ Gastos

function AbaGastos({ gastos }: { gastos: ReturnType<typeof unificarGastos> }) {
  const meses = [...new Set(gastos.map((g) => g.mes))].sort()
  const [periodo, setPeriodo] = useState<1 | 3 | 12>(3)
  if (!meses.length) return <Vazio titulo="Sem gastos ainda" texto="Importe faturas ou extratos para liberar as análises de gastos." />

  const ultimo = meses.at(-1)!
  const recorrencias = detectarRecorrencias(gastos)
  const ativas = recorrencias.filter((r) => r.ativa)
  const desvios = foraDoPadrao(gastos, ultimo)
  const mapa = mapaCalor(gastos)
  const mesesPeriodo = meses.slice(-periodo)
  const ranking = rankingEstabelecimentos(gastos, mesesPeriodo)
  const dias = gastoPorDiaDaSemana(gastos, mesesPeriodo)
  const maxDia = Math.max(...dias, 1)

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card atraso={1}>
          <CabecalhoCard
            titulo="Assinaturas e gastos recorrentes"
            sub={recorrencias.length ? `${ativas.length} ativas · ${moeda(ativas.reduce((s, r) => s + r.custoAnual, 0))} por ano` : 'Precisa de pelo menos 2 meses importados'}
          />
          {recorrencias.length ? (
            <ul className="divide-y divide-linha">
              {recorrencias.slice(0, 12).map((r) => (
                <li key={r.chave} className={`flex items-center justify-between gap-3 py-2 text-sm ${r.ativa ? '' : 'opacity-50'}`}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: corCategoria(r.categoria) }} />
                    <span className="truncate">{r.nome}</span>
                    {r.fixo && r.ativa && <span className="shrink-0 rounded-md bg-violeta/15 px-1.5 py-0.5 font-mono text-[10px] text-violeta">valor fixo</span>}
                    {!r.ativa && <span className="shrink-0 font-mono text-[10px] text-apagado uppercase">parou em {rotuloMes(r.ultimoMes)}</span>}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="num">{moeda(r.valorMedio)}</span>
                    <span className="num ml-2 font-mono text-[11px] text-apagado">{moedaCurta(r.custoAnual)}/ano</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-suave">Com 2 ou mais meses de faturas, o app encontra sozinho o que se repete.</p>
          )}
        </Card>

        <Card atraso={2}>
          <CabecalhoCard titulo="Fora do padrão" sub={`${rotuloMes(ultimo, true)} comparado com a média dos meses anteriores`} />
          {desvios.length ? (
            <ul className="space-y-2">
              {desvios.map((x) => (
                <li key={x.tipo + x.rotulo} className="flex items-start gap-3 rounded-xl border border-ambar/25 bg-ambar/5 px-3 py-2.5 text-sm">
                  <IcAlerta className="mt-0.5 shrink-0 text-ambar" width={15} height={15} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {x.tipo === 'novo' ? `Novo: ${x.rotulo}` : x.rotulo}
                      <span className="num ml-2 text-ambar">{moeda(x.valor)}</span>
                    </div>
                    <div className="text-xs text-suave">
                      {x.tipo === 'novo'
                        ? `Estabelecimento que não aparecia antes · ${x.categoria}`
                        : x.razao
                          ? `${x.razao.toFixed(1).replace('.', ',')}× a média de ${moeda(x.referencia)} (+${moeda(x.valor - x.referencia)})`
                          : `Sem gasto nessa categoria nos meses anteriores`}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : meses.length < 2 ? (
            <p className="text-sm text-suave">Precisa de pelo menos 2 meses para comparar.</p>
          ) : (
            <p className="text-sm text-neon">Nada fora do normal neste mês.</p>
          )}
        </Card>
      </div>

      <Card atraso={3}>
        <CabecalhoCard titulo="Mapa de calor" sub="Gasto por categoria em cada mês · quanto mais forte, maior" />
        {mapa.meses.length ? <Calor mapa={mapa} /> : null}
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card atraso={4} className="!p-0">
          <div className="p-5 pb-0">
            <CabecalhoCard
              titulo="Onde você mais gasta"
              acao={
                <div className="flex gap-1.5">
                  {([1, 3, 12] as const).map((p) => (
                    <Chip key={p} ativo={periodo === p} onClick={() => setPeriodo(p)}>
                      {p === 1 ? 'mês' : `${p} meses`}
                    </Chip>
                  ))}
                </div>
              }
            />
          </div>
          <div className="rolagem-fina overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="rotulo text-left">
                  <th className="px-5 py-2 font-normal">Estabelecimento</th>
                  <th className="px-3 py-2 text-right font-normal">Vezes</th>
                  <th className="px-3 py-2 text-right font-normal">Ticket</th>
                  <th className="px-3 py-2 font-normal">Dia</th>
                  <th className="px-5 py-2 text-right font-normal">Total</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((e) => (
                  <tr key={e.nome} className="border-t border-linha">
                    <td className="px-5 py-2">
                      <span className="flex items-center gap-2">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: corCategoria(e.categoria) }} />
                        <span className="truncate">{e.nome}</span>
                      </span>
                    </td>
                    <td className="num px-3 py-2 text-right text-suave">{e.vezes}</td>
                    <td className="num px-3 py-2 text-right text-suave">{moeda(e.ticketMedio)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-suave">{DIAS_SEMANA[e.diaFavorito]}</td>
                    <td className="num px-5 py-2 text-right font-medium">{moeda(e.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card atraso={5}>
          <CabecalhoCard titulo="Por dia da semana" sub="Pela data da compra" />
          <div className="flex h-44 items-end gap-2">
            {dias.map((v, i) => (
              <div key={i} className="group flex flex-1 flex-col items-center gap-1.5" title={moeda(v)}>
                <span className="num font-mono text-[10px] text-apagado opacity-0 transition group-hover:opacity-100">{compacto.format(v)}</span>
                <div
                  className="w-full rounded-t-md bg-violeta transition-[height] duration-700"
                  style={{ height: `${Math.max(2, (v / maxDia) * 120)}px`, opacity: v === maxDia ? 1 : 0.55 }}
                />
                <span className="font-mono text-[11px] text-suave">{DIAS_SEMANA[i]}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-suave">
            Você gasta mais às <b className="text-texto">{['domingos', 'segundas', 'terças', 'quartas', 'quintas', 'sextas', 'sábados'][dias.indexOf(maxDia)]}</b>.
          </p>
        </Card>
      </div>
    </div>
  )
}

function Calor({ mapa }: { mapa: ReturnType<typeof mapaCalor> }) {
  return (
    <div className="rolagem-fina overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th />
            {mapa.meses.map((m) => (
              <th key={m} className="font-mono font-normal text-apagado">
                {rotuloMes(m)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mapa.categorias.map((c, i) => (
            <tr key={c}>
              <td className="pr-2 whitespace-nowrap text-suave">{c}</td>
              {mapa.valores[i].map((v, j) => {
                const p = mapa.max ? v / mapa.max : 0
                return (
                  <td
                    key={j}
                    title={`${c} · ${rotuloMes(mapa.meses[j], true)}: ${moeda(v)}`}
                    className="num h-9 min-w-14 rounded-md text-center font-mono text-[10px]"
                    style={{
                      background: v ? `color-mix(in oklab, var(--color-violeta) ${Math.round(12 + p * 78)}%, transparent)` : 'rgb(255 255 255 / 0.02)',
                      color: p > 0.45 ? 'var(--color-fundo)' : 'var(--color-suave)',
                    }}
                  >
                    {v ? compacto.format(v) : ''}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ------------------------------------------------------------------ Planejamento

function AbaPlanejamento({ d }: { d: ReturnType<typeof useDados> }) {
  const [retorno, setRetorno] = useState(4)
  const [retirada, setRetirada] = useState(4)
  const comp = comprometimento(d.projecao, parcelasCartaoPorMes(d.lancamentos, parcelasFuturas(d.lancamentos)))
  const agora = comp[0]
  const reserva = reservaEmergencia(d.ativos, d.projecao)
  const aporte = d.projecao.length ? d.projecao.reduce((s, p) => s + p.saldo, 0) / d.projecao.length : 0
  const indep = independenciaFinanceira({ ativos: d.ativos, custoMensal: reserva.custoMensal, aporteMensal: aporte, retornoRealAnual: retorno / 100, taxaRetirada: retirada / 100 })
  const textoNivel = { saudavel: 'text-neon', atencao: 'text-ambar', alto: 'text-rosa' } as const
  const fundoNivel = { saudavel: 'bg-neon', atencao: 'bg-ambar', alto: 'bg-rosa' } as const
  const semRenda = !agora || agora.renda === 0

  return (
    <div className="space-y-5">
      <Card atraso={1}>
        <CabecalhoCard titulo="Comprometimento de renda" sub="Parte da renda já presa em parcelas: imóvel, dívidas e compras parceladas no cartão" />
        {semRenda ? (
          <Vazio titulo="Sem renda cadastrada" texto="Cadastre suas entradas em Fluxo para calcular quanto da renda está comprometida." />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <div className={`num font-display text-5xl font-bold tracking-tight ${textoNivel[agora.nivel]}`}>{percentual(agora.fracao ?? 0)}</div>
              <div className="mt-1 text-sm text-suave">
                {moeda(agora.total)} de {moeda(agora.renda)} em {rotuloMes(agora.mes, true)} ·{' '}
                {agora.nivel === 'saudavel' ? 'saudável (até 30%)' : agora.nivel === 'atencao' ? 'atenção (30% a 40%)' : 'alto (acima de 40%)'}
              </div>
              <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-white/[0.05]">
                {[
                  { v: agora.imovel, cor: 'var(--color-ambar)' },
                  { v: agora.dividas, cor: 'var(--color-rosa)' },
                  { v: agora.parcelasCartao, cor: 'var(--color-violeta)' },
                ].map((s, i) => (
                  <div key={i} style={{ width: `${(s.v / agora.renda) * 100}%`, background: s.cor }} className="h-full border-r-2 border-painel last:border-0" />
                ))}
              </div>
              <div className="mt-2">
                <Legenda
                  itens={[
                    { cor: 'var(--color-ambar)', rotulo: `Imóvel ${moedaCurta(agora.imovel)}` },
                    { cor: 'var(--color-rosa)', rotulo: `Dívidas ${moedaCurta(agora.dividas)}` },
                    { cor: 'var(--color-violeta)', rotulo: `Parcelas ${moedaCurta(agora.parcelasCartao)}` },
                  ]}
                />
              </div>
            </div>
            <div>
              <div className="rotulo mb-2">Próximos 12 meses</div>
              <div className="flex h-36 items-end gap-1.5">
                {comp.map((c) => (
                  <div key={c.mes} className="flex flex-1 flex-col items-center gap-1" title={`${rotuloMes(c.mes, true)}: ${percentual(c.fracao ?? 0)} (${moeda(c.total)})`}>
                    <span className="num font-mono text-[9px] text-apagado">{Math.round((c.fracao ?? 0) * 100)}</span>
                    <div className={`w-full rounded-t ${fundoNivel[c.nivel]}`} style={{ height: `${Math.max(2, Math.min(1, (c.fracao ?? 0) / 0.6) * 100)}px` }} />
                    <span className="font-mono text-[9px] text-apagado">{rotuloMes(c.mes)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-suave">Em % da renda. A linha de corte saudável é 30%.</p>
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card atraso={2}>
          <CabecalhoCard titulo="Reserva de emergência" sub="Contas + investimentos cadastrados em Patrimônio" />
          {reserva.custoMensal === 0 ? (
            <Vazio titulo="Sem custos projetados" texto="Cadastre contas fixas em Fluxo e importe faturas para calcular." />
          ) : (
            <>
              <div className="flex items-baseline gap-3">
                <span className={`num font-display text-5xl font-bold tracking-tight ${reserva.meses >= 6 ? 'text-neon' : reserva.meses >= 3 ? 'text-ambar' : 'text-rosa'}`}>
                  {reserva.meses.toFixed(1).replace('.', ',')}
                </span>
                <span className="text-sm text-suave">meses de despesas cobertos</span>
              </div>
              <div className="mt-4">
                <Progresso valor={reserva.meses / reserva.alvoMeses} cor={reserva.meses >= 6 ? 'neon' : reserva.meses >= 3 ? 'ambar' : 'rosa'} />
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="rotulo">Reserva</dt>
                  <dd className="num mt-0.5">{moedaCurta(reserva.liquido)}</dd>
                </div>
                <div>
                  <dt className="rotulo">Custo/mês</dt>
                  <dd className="num mt-0.5">{moedaCurta(reserva.custoMensal)}</dd>
                </div>
                <div>
                  <dt className="rotulo">Falta p/ 6 meses</dt>
                  <dd className={`num mt-0.5 ${reserva.falta ? 'text-ambar' : 'text-neon'}`}>{reserva.falta ? moedaCurta(reserva.falta) : 'nada'}</dd>
                </div>
              </dl>
            </>
          )}
        </Card>

        <Card atraso={3} destaque>
          <CabecalhoCard titulo="Independência financeira" sub="Patrimônio que paga o seu custo de vida para sempre" />
          {reserva.custoMensal === 0 ? (
            <Vazio titulo="Sem custos projetados" texto="Cadastre contas fixas em Fluxo para calcular." />
          ) : (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="num font-display text-3xl font-bold tracking-tight texto-neon">{moedaCurta(indep.alvo)}</span>
                <span className="text-sm text-suave">{indep.anos === null ? 'não chega no ritmo atual' : indep.anos === 0 ? 'você já chegou!' : `em ~${Math.ceil(indep.anos)} anos (${new Date().getFullYear() + Math.ceil(indep.anos)})`}</span>
              </div>
              <div className="mt-3">
                <Progresso valor={indep.progresso} />
              </div>
              <div className="mt-1 flex justify-between text-xs text-suave">
                <span>{moedaCurta(indep.investido)} investidos</span>
                <span>{percentual(indep.progresso)}</span>
              </div>
              <p className="mt-3 text-xs text-suave">
                Custo de vida de {moeda(indep.custoAnual)}/ano ÷ retirada de {retirada}% ao ano. Aporte médio projetado: {moeda(Math.max(0, aporte))}/mês.
                {aporte <= 0 && <span className="text-rosa"> Sem sobra mensal, o patrimônio não cresce.</span>}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Campo rotulo="Retorno acima da inflação" type="number" step="0.5" sufixo="% a.a." value={retorno} onChange={(e) => setRetorno(Number(e.target.value))} />
                <Campo rotulo="Retirada segura" type="number" step="0.5" sufixo="% a.a." value={retirada} onChange={(e) => setRetirada(Math.max(1, Number(e.target.value)))} />
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ Parcelas

function AbaParcelas({ d }: { d: ReturnType<typeof useDados> }) {
  const a = alivioDeCaixa(d.lancamentos, d.dividas, d.hoje)
  const totalHoje = (a.porMes[0]?.cartao ?? 0) + (a.porMes[0]?.dividas ?? 0)
  const totalFim = (a.porMes.at(-1)?.cartao ?? 0) + (a.porMes.at(-1)?.dividas ?? 0)
  if (!a.compras.length && !d.dividas.length)
    return <Vazio titulo="Nada parcelado" texto="Sem compras parceladas em aberto nem dívidas cadastradas." />

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        <Kpi rotulo="Parcelas este mês" valor={moeda(totalHoje)} tom="violeta" detalhe="cartão + dívidas" />
        <Kpi rotulo={`Em ${rotuloMes(somaMeses(d.hoje, 11), true)}`} valor={moeda(totalFim)} tom="neon" atraso={1} detalhe={`libera ${moeda(totalHoje - totalFim)}/mês`} />
        <Kpi rotulo="Compras parceladas" valor={`${a.compras.length}`} tom="ambar" atraso={2} detalhe={`${moeda(a.compras.reduce((s, c) => s + c.valorParcela * c.restantes, 0))} ainda a pagar`} />
        <Kpi rotulo="Próximo alívio" valor={a.marcos[0] ? rotuloMes(somaMeses(a.marcos[0].mes, 1), true) : '—'} tom="neon" atraso={3} detalhe={a.marcos[0] ? `+${moeda(a.marcos[0].libera)}/mês` : undefined} />
      </div>

      <Card atraso={2}>
        <CabecalhoCard
          titulo="Parcelas por mês"
          sub="O que já está comprometido; cada degrau para baixo é dinheiro que volta para você"
          acao={
            <Legenda
              itens={[
                { cor: 'var(--color-violeta)', rotulo: 'Cartão' },
                { cor: 'var(--color-rosa)', rotulo: 'Dívidas' },
              ]}
            />
          }
        />
        <GraficoBarras
          rotulos={a.porMes.map((p) => rotuloMes(p.mes))}
          series={[
            { nome: 'Cartão', cor: 'var(--color-violeta)' },
            { nome: 'Dívidas', cor: 'var(--color-rosa)' },
          ]}
          valores={[a.porMes.map((p) => p.cartao), a.porMes.map((p) => p.dividas)]}
          altura={240}
        />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card atraso={3}>
          <CabecalhoCard titulo="Linha do tempo do alívio" sub="Mês da última parcela → sobra a partir do mês seguinte" />
          {a.marcos.length ? (
            <ol className="relative space-y-4 border-l border-linha-forte pl-5">
              {a.marcos.map((m) => (
                <li key={m.mes} className="relative">
                  <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full bg-neon shadow-[0_0_10px_var(--color-neon)]" />
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-display font-semibold">{rotuloMes(somaMeses(m.mes, 1), true)}</span>
                    <span className="num text-neon">+{moeda(m.libera)}/mês</span>
                  </div>
                  <div className="text-xs text-suave">termina: {m.itens.join(', ')}</div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-suave">Nenhuma parcela termina nos próximos 12 meses.</p>
          )}
        </Card>

        <Card atraso={4} className="!p-0">
          <div className="p-5 pb-0">
            <CabecalhoCard titulo="Compras parceladas em aberto" />
          </div>
          <div className="rolagem-fina overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="rotulo text-left">
                <th className="px-5 py-2 font-normal">Compra</th>
                <th className="px-3 py-2 text-right font-normal">Parcela</th>
                <th className="px-3 py-2 text-right font-normal">Faltam</th>
                <th className="px-5 py-2 text-right font-normal">Termina</th>
              </tr>
            </thead>
            <tbody>
              {a.compras.map((c, i) => (
                <tr key={i} className="border-t border-linha">
                  <td className="px-5 py-2">
                    {c.nome}
                    <div className="text-[11px] text-apagado">{c.origem}</div>
                  </td>
                  <td className="num px-3 py-2 text-right">{moeda(c.valorParcela)}</td>
                  <td className="num px-3 py-2 text-right text-suave">{c.restantes}</td>
                  <td className="px-5 py-2 text-right font-mono text-xs text-suave">{rotuloMes(c.fim, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
