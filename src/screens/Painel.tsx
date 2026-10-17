import { Link } from 'react-router-dom'
import { BarrasCategoria, Faisca, GraficoBarras, GraficoLinha } from '../components/graficos'
import { Botao, CabecalhoCard, Card, Kpi, Legenda, Progresso, Vazio } from '../components/ui'
import { avaliarMetas, gastosDoMes } from '../engine/orcamento'
import { parcelasFuturas } from '../engine/projecao'
import { corCategoria, porCategoria, useDados, useRegistrarSnapshot } from '../lib/dados'
import { carregarDemo } from '../lib/demo'
import { difMeses, moeda, moedaCurta, rotuloMes } from '../lib/format'

export default function Painel() {
  const d = useDados()
  useRegistrarSnapshot(d)
  if (!d.carregado) return null

  const vazio =
    d.lancamentos.length + d.recorrentes.length + d.dividas.length + d.movimentos.length + d.ativos.length === 0 && !d.financiamento
  if (vazio) return <BoasVindas />

  const p = d.projecao
  const esteMes = p[0]
  const final = p.at(-1)!
  const rotulos = p.map((m) => rotuloMes(m.mes))

  const linhaHoje = d.tabela.find((l) => l.mes === d.hoje)
  const linhaAnterior = d.tabela.filter((l) => difMeses(l.mes, d.hoje) >= 0).at(-1)
  const saldoDevedor = linhaAnterior?.saldoFinal ?? d.financiamento?.valorFinanciado ?? 0
  const quitado = d.financiamento ? 1 - saldoDevedor / d.financiamento.valorFinanciado : 0
  const fimImovel = d.tabela.at(-1)?.mes

  const totalDividas = d.dividas.reduce((s, x) => s + x.saldo, 0)
  const faturaAtual = d.lancamentos.filter((l) => l.faturaRef === d.hoje)
  const refCategorias = faturaAtual.length ? d.hoje : [...new Set(d.lancamentos.map((l) => l.faturaRef))].sort().at(-1)
  const categorias = porCategoria(d.lancamentos.filter((l) => l.faturaRef === refCategorias)).slice(0, 8)
  const parcelas = [...parcelasFuturas(d.lancamentos).entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 6)
  const renda = esteMes.entradas

  const agora = new Date()
  const fracao = agora.getDate() / new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate()
  const metas = avaliarMetas(d.metas, gastosDoMes(d.hoje, d.lancamentos, d.movimentos), fracao)
  const orcado = metas.reduce((s, m) => s + m.limite, 0)
  const gastoMetas = metas.reduce((s, m) => s + m.gasto, 0)
  const pl = d.patrimonio
  const plFinal = d.projecaoPatrimonio.at(-1)

  return (
    <div className="space-y-5">
      <div className="entrar flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="rotulo">{rotuloMes(d.hoje, true)} · visão geral</div>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight md:text-3xl">Seu dinheiro, nos próximos 12 meses</h1>
        </div>
        <Link to="/importar">
          <Botao variante="primario">Importar PDF</Botao>
        </Link>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Card destaque className="overflow-hidden !p-6">
          <div className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-neon/10 blur-3xl" />
          <div className="rotulo">Caixa acumulado em {rotuloMes(final.mes, true)}</div>
          <div className={`num mt-2 font-display text-[clamp(2.1rem,5vw,3.4rem)] leading-none font-bold tracking-tight ${final.acumulado >= 0 ? 'texto-neon' : 'text-rosa'}`}>
            {moeda(final.acumulado)}
          </div>
          <p className="mt-3 max-w-md text-sm text-suave">
            Este mês sobram <b className={esteMes.saldo >= 0 ? 'text-neon' : 'text-rosa'}>{moeda(esteMes.saldo)}</b> depois de cartão, imóvel, dívidas e
            contas fixas.
            {p.some((m) => m.saldo < 0) && <> Atenção: {p.filter((m) => m.saldo < 0).length} mês(es) fecham no vermelho.</>}
          </p>
          <div className="mt-5">
            <Faisca valores={p.map((m) => m.acumulado)} cor={final.acumulado >= 0 ? 'var(--color-neon)' : 'var(--color-rosa)'} />
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4 xl:grid-cols-2">
          <Kpi rotulo="Entradas" valor={moedaCurta(renda)} tom="neon" atraso={1} detalhe={`${d.recorrentes.filter((r) => r.natureza === 'entrada').length} fontes de receita`} />
          <Kpi
            rotulo="Cartão"
            valor={moedaCurta(esteMes.cartao)}
            tom="violeta"
            atraso={2}
            detalhe={esteMes.cartaoReal ? 'fatura importada' : 'estimativa'}
          />
          <Kpi
            rotulo="Imóvel"
            valor={linhaHoje ? moedaCurta(linhaHoje.parcela) : '—'}
            tom="ambar"
            atraso={3}
            detalhe={linhaHoje ? `${linhaHoje.n}ª de ${d.tabela.length}` : 'cadastre em Imóvel'}
          />
          <Kpi
            rotulo="Dívidas"
            valor={moedaCurta(totalDividas)}
            tom="rosa"
            atraso={4}
            detalhe={renda ? `${((esteMes.dividas / renda) * 100).toFixed(0)}% da renda em parcelas` : `${d.dividas.length} ativas`}
          />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card atraso={2}>
          <CabecalhoCard
            titulo="Entradas × saídas"
            sub="Projeção mês a mês com faturas importadas, parcelas e contas fixas"
            acao={
              <Legenda
                itens={[
                  { cor: 'var(--color-neon)', rotulo: 'Entradas' },
                  { cor: 'var(--color-violeta)', rotulo: 'Saídas' },
                ]}
              />
            }
          />
          <GraficoBarras
            rotulos={rotulos}
            series={[
              { nome: 'Entradas', cor: 'var(--color-neon)' },
              { nome: 'Saídas', cor: 'var(--color-violeta)' },
            ]}
            valores={[p.map((m) => m.entradas), p.map((m) => m.fixas + m.financiamento + m.dividas + m.cartao)]}
          />
        </Card>

        <Card atraso={3}>
          <CabecalhoCard titulo="Para onde vai o cartão" sub={refCategorias ? `Fatura de ${rotuloMes(refCategorias, true)}` : 'Nenhuma fatura ainda'} />
          {categorias.length ? (
            <BarrasCategoria itens={categorias} />
          ) : (
            <Vazio titulo="Sem faturas" texto="Importe o PDF da fatura para ver as categorias." />
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card atraso={4} className="lg:col-span-2">
          <CabecalhoCard titulo="Caixa acumulado" sub="Quanto sobra somando os meses" />
          <GraficoLinha rotulos={rotulos} series={[{ nome: 'Acumulado', cor: 'var(--color-neon)' }]} valores={[p.map((m) => m.acumulado)]} altura={200} />
        </Card>

        <Card atraso={5}>
          <CabecalhoCard titulo="Imóvel" sub={d.financiamento ? `SAC + TR · termina em ${fimImovel ? rotuloMes(fimImovel, true) : '—'}` : 'Não cadastrado'} />
          {d.financiamento ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="num font-display text-2xl font-semibold">{(quitado * 100).toFixed(1)}%</span>
                <span className="text-xs text-suave">quitado</span>
              </div>
              <div className="mt-3">
                <Progresso valor={quitado} cor="ambar" />
              </div>
              <dl className="mt-5 space-y-2 text-sm">
                <Linha rotulo="Saldo devedor" valor={moeda(saldoDevedor)} />
                <Linha rotulo="Parcela atual" valor={linhaHoje ? moeda(linhaHoje.parcela) : '—'} />
                <Linha rotulo="Faltam" valor={`${d.tabela.filter((l) => difMeses(d.hoje, l.mes) >= 0).length} parcelas`} />
              </dl>
            </>
          ) : (
            <Vazio titulo="Sem financiamento" texto="Cadastre o contrato para acompanhar saldo e amortizações." acao={<Link to="/imovel"><Botao>Cadastrar</Botao></Link>} />
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card atraso={5}>
          <CabecalhoCard
            titulo="Metas do mês"
            sub={orcado ? `${moeda(gastoMetas)} de ${moeda(orcado)} · ${Math.round(fracao * 100)}% do mês passou` : 'Limites por categoria'}
            acao={
              <Link to="/metas" className="font-mono text-xs text-neon hover:underline">
                ver todas →
              </Link>
            }
          />
          {metas.length ? (
            <ul className="space-y-3">
              {metas.slice(0, 5).map((m) => (
                <li key={m.categoria}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ background: corCategoria(m.categoria) }} />
                      {m.categoria}
                      {m.status !== 'ok' && (
                        <span className={`font-mono text-[10px] uppercase ${m.status === 'estourou' ? 'text-rosa' : 'text-ambar'}`}>
                          {m.status === 'estourou' ? 'estourou' : 'atenção'}
                        </span>
                      )}
                    </span>
                    <span className="num text-suave">
                      {moeda(m.gasto)} <span className="text-apagado">/ {moeda(m.limite)}</span>
                    </span>
                  </div>
                  <Progresso valor={m.uso} cor={m.status === 'ok' ? 'neon' : m.status === 'atencao' ? 'ambar' : 'rosa'} />
                </li>
              ))}
            </ul>
          ) : (
            <Vazio
              titulo="Sem metas"
              texto="Defina limites por categoria e acompanhe o mês."
              acao={
                <Link to="/metas">
                  <Botao>Criar metas</Botao>
                </Link>
              }
            />
          )}
        </Card>

        <Card atraso={6}>
          <CabecalhoCard
            titulo="Patrimônio líquido"
            sub="Ativos − imóvel financiado − dívidas"
            acao={
              <Link to="/patrimonio" className="font-mono text-xs text-neon hover:underline">
                detalhes →
              </Link>
            }
          />
          {d.ativos.length || d.financiamento ? (
            <>
              <div className={`num font-display text-3xl font-semibold tracking-tight ${pl.liquido >= 0 ? '' : 'text-rosa'}`}>{moeda(pl.liquido)}</div>
              {plFinal && (
                <div className="mt-1 text-sm text-suave">
                  {rotuloMes(plFinal.mes, true)}: <span className="text-texto">{moedaCurta(plFinal.liquido)}</span>{' '}
                  <span className={plFinal.liquido >= pl.liquido ? 'text-neon' : 'text-rosa'}>
                    ({plFinal.liquido >= pl.liquido ? '+' : ''}
                    {moedaCurta(plFinal.liquido - pl.liquido)})
                  </span>
                </div>
              )}
              <div className="mt-4">
                <Faisca valores={[pl.liquido, ...d.projecaoPatrimonio.map((s) => s.liquido)]} cor="var(--color-violeta)" altura={64} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="rotulo">Ativos</div>
                  <div className="num mt-0.5">{moedaCurta(pl.ativos)}</div>
                </div>
                <div>
                  <div className="rotulo">Passivos</div>
                  <div className="num mt-0.5 text-rosa">{moedaCurta(pl.passivos)}</div>
                </div>
              </div>
            </>
          ) : (
            <Vazio
              titulo="Sem ativos"
              texto="Cadastre conta, investimentos e imóveis."
              acao={
                <Link to="/patrimonio">
                  <Botao>Cadastrar</Botao>
                </Link>
              }
            />
          )}
        </Card>
      </div>

      <Card atraso={7}>
        <CabecalhoCard titulo="Parcelas já comprometidas no cartão" sub="Compras parceladas que ainda vão cair nas próximas faturas" />
        {parcelas.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {parcelas.map(([mes, v]) => (
              <div key={mes} className="rounded-xl border border-linha bg-white/[0.02] p-3">
                <div className="rotulo">{rotuloMes(mes, true)}</div>
                <div className="num mt-1 font-display text-lg font-semibold">{moeda(v)}</div>
                <div className="text-[11px] text-apagado">{difMeses(d.hoje, mes) === 1 ? 'próxima fatura' : `em ${difMeses(d.hoje, mes)} meses`}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-suave">Nenhuma compra parcelada em aberto.</p>
        )}
      </Card>
    </div>
  )
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-linha pb-2 last:border-0">
      <dt className="text-suave">{rotulo}</dt>
      <dd className="num font-medium">{valor}</dd>
    </div>
  )
}

function BoasVindas() {
  const passos = [
    { to: '/importar', t: 'Importe as faturas', d: 'Solte os PDFs do Nubank, C6 e outros. A leitura acontece no navegador.' },
    { to: '/fluxo', t: 'Cadastre receitas e contas fixas', d: 'Salário, aluguel, escola, condomínio: a base da projeção.' },
    { to: '/imovel', t: 'Configure o financiamento', d: 'SAC + TR, com simulação de amortização extra.' },
    { to: '/dividas', t: 'Liste as dívidas', d: 'Compare avalanche e bola de neve para quitar mais rápido.' },
  ]
  return (
    <div className="mx-auto max-w-4xl">
      <div className="entrar py-6 md:py-12">
        <div className="rotulo">primeiro acesso</div>
        <h1 className="mt-2 font-display text-4xl leading-[1.05] font-bold tracking-tight md:text-6xl">
          Tudo o que entra, sai e <span className="texto-neon">ainda vai sair</span>.
        </h1>
        <p className="mt-4 max-w-xl text-suave">Cartão, imóvel, dívidas e receitas num só lugar, com projeção de 12 meses. Nada sai do seu aparelho.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/importar">
            <Botao variante="primario">Importar primeira fatura</Botao>
          </Link>
          <Botao onClick={() => carregarDemo()}>Ver com dados de exemplo</Botao>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {passos.map((p, i) => (
          <Link key={p.to} to={p.to}>
            <Card atraso={i + 1} className="h-full transition hover:border-linha-forte">
              <div className="font-mono text-xs text-neon">0{i + 1}</div>
              <div className="mt-2 font-display font-semibold">{p.t}</div>
              <p className="mt-1 text-sm text-suave">{p.d}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

