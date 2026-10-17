import { useState } from 'react'
import { Botao, Chip, Progresso } from '../components/ui'
import { montarRelatorio } from '../engine/relatorio'
import { parcelasFuturas } from '../engine/projecao'
import { saldoDevedorEm } from '../engine/patrimonio'
import { corCategoria, useDados } from '../lib/dados'
import { difMeses, moeda, percentual, rotuloData, rotuloMes, rotuloMesLongo, somaMeses } from '../lib/format'

function Bloco({ titulo, children, className = '' }: { titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`quebra-evitar ${className}`}>
      <h2 className="rotulo mb-3 border-b border-linha pb-2 !text-suave">{titulo}</h2>
      {children}
    </section>
  )
}

function Numero({ rotulo, valor, detalhe, tom }: { rotulo: string; valor: string; detalhe?: React.ReactNode; tom?: string }) {
  return (
    <div className="rounded-xl border border-linha p-3">
      <div className="rotulo">{rotulo}</div>
      <div className={`num mt-1 font-display text-xl font-semibold tracking-tight ${tom ?? ''}`}>{valor}</div>
      {detalhe && <div className="mt-0.5 text-[11px] text-suave">{detalhe}</div>}
    </div>
  )
}

const variacaoTexto = (v: number | null) => (v === null ? 'novo' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(0)}%`)

export default function Relatorio() {
  const d = useDados()
  const [escolhido, setEscolhido] = useState<string | null>(null)
  if (!d.carregado) return null

  const meses = [...new Set([...d.lancamentos.map((l) => l.faturaRef), ...d.movimentos.map((m) => m.data.slice(0, 7)), d.hoje])]
    .filter((m) => m <= d.hoje)
    .sort()
    .slice(-12)
  const mes = escolhido ?? d.hoje
  const r = montarRelatorio({ mes, lancamentos: d.lancamentos, movimentos: d.movimentos, recorrentes: d.recorrentes, metas: d.metas })

  const foto = mes === d.hoje ? { ...d.patrimonio } : d.snapshots.find((s) => s.mes === mes)
  const fotoAnterior = d.snapshots.find((s) => s.mes === somaMeses(mes, -1))
  const linhaImovel = d.tabela.find((l) => l.mes === mes)
  const saldoImovel = d.financiamento ? saldoDevedorEm(d.tabela, mes, d.financiamento.valorFinanciado) : 0
  const parcelas = [...parcelasFuturas(d.lancamentos).entries()].filter(([m]) => difMeses(mes, m) > 0).sort(([a], [b]) => a.localeCompare(b)).slice(0, 6)
  const maxCat = Math.max(...r.categorias.map((c) => c.valor), 1)
  const variacaoGastos = r.gastosAnterior > 0 ? r.gastos / r.gastosAnterior - 1 : null

  return (
    <div>
      <div className="no-print entrar mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Relatório mensal</h1>
          <p className="mt-1 text-sm text-suave">Resumo do mês pronto para imprimir ou salvar em PDF (A4).</p>
        </div>
        <Botao variante="primario" onClick={() => window.print()}>
          Imprimir / Salvar PDF
        </Botao>
      </div>
      <div className="no-print rolagem-fina mb-5 flex gap-2 overflow-x-auto pb-1">
        {meses.map((m) => (
          <Chip key={m} ativo={m === mes} onClick={() => setEscolhido(m)}>
            {rotuloMes(m, true)}
          </Chip>
        ))}
      </div>

      <article className="vidro entrar mx-auto max-w-[860px] space-y-7 p-6 md:p-10">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-linha pb-5">
          <div>
            <div className="flex items-center gap-2">
              <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="size-6 rounded-md" />
              <span className="font-display text-sm font-semibold">
                finanças<span className="text-neon">.</span>
              </span>
            </div>
            <div className="rotulo mt-4">Relatório mensal</div>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{rotuloMesLongo(mes).replace(/^./, (c) => c.toUpperCase())}</h2>
          </div>
          <div className="text-right text-xs text-suave">
            Gerado em {new Date().toLocaleDateString('pt-BR')}
            {mes === d.hoje && <div className="text-ambar">mês em andamento</div>}
          </div>
        </header>

        <Bloco titulo="Resumo">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Numero rotulo="Entradas" valor={moeda(r.entradas)} tom="text-neon" detalhe={r.fonteEntradas === 'extrato' ? 'pelo extrato' : 'pelo cadastro em Fluxo'} />
            <Numero
              rotulo="Gastos"
              valor={moeda(r.gastos)}
              detalhe={variacaoGastos === null ? 'sem mês anterior' : `${variacaoTexto(variacaoGastos)} vs. ${rotuloMes(somaMeses(mes, -1))}`}
            />
            <Numero
              rotulo="Sobra"
              valor={moeda(r.sobra)}
              tom={r.sobra >= 0 ? '' : 'text-rosa'}
              detalhe={r.taxaPoupanca !== null ? `${percentual(r.taxaPoupanca)} da renda` : undefined}
            />
            <Numero rotulo="Investido" valor={moeda(r.investido)} tom="text-violeta" detalhe="aplicações no extrato" />
          </div>
        </Bloco>

        <Bloco titulo="Gastos por categoria · cartão (fatura do mês) + conta corrente">
          {r.categorias.length ? (
            <table className="w-full text-sm">
              <tbody>
                {r.categorias.map((c) => (
                  <tr key={c.categoria} className="border-b border-linha last:border-0">
                    <td className="w-36 py-1.5">
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ background: corCategoria(c.categoria) }} />
                        {c.categoria}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3">
                      <div className="h-1.5 rounded-full bg-linha">
                        <div className="h-full rounded-full" style={{ width: `${(c.valor / maxCat) * 100}%`, background: corCategoria(c.categoria) }} />
                      </div>
                    </td>
                    <td className="num w-28 py-1.5 text-right">{moeda(c.valor)}</td>
                    <td className={`num w-16 py-1.5 text-right font-mono text-[11px] ${c.variacao !== null && c.variacao > 0.15 ? 'text-rosa' : 'text-apagado'}`}>
                      {variacaoTexto(c.variacao)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-suave">Nenhum gasto registrado neste mês.</p>
          )}
        </Bloco>

        {r.metas.length > 0 && (
          <Bloco titulo="Metas">
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {r.metas.map((m) => (
                <div key={m.categoria}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>
                      {m.categoria}{' '}
                      <span className={`font-mono text-[10px] uppercase ${m.status === 'ok' ? 'text-neon' : m.status === 'atencao' ? 'text-ambar' : 'text-rosa'}`}>
                        {m.status === 'ok' ? 'ok' : m.status === 'atencao' ? 'atenção' : 'estourou'}
                      </span>
                    </span>
                    <span className="num text-suave">
                      {moeda(m.gasto)} / {moeda(m.limite)}
                    </span>
                  </div>
                  <Progresso valor={m.uso} cor={m.status === 'ok' ? 'neon' : m.status === 'atencao' ? 'ambar' : 'rosa'} />
                </div>
              ))}
            </div>
          </Bloco>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          <Bloco titulo="Patrimônio">
            {foto ? (
              <>
                <div className="num font-display text-2xl font-semibold">{moeda(foto.liquido)}</div>
                <div className="mt-1 text-xs text-suave">
                  ativos {moeda(foto.ativos)} · passivos {moeda(foto.passivos)}
                </div>
                {fotoAnterior && (
                  <div className={`mt-1 text-xs ${foto.liquido >= fotoAnterior.liquido ? 'text-neon' : 'text-rosa'}`}>
                    {foto.liquido >= fotoAnterior.liquido ? '+' : ''}
                    {moeda(foto.liquido - fotoAnterior.liquido)} no mês
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-suave">Sem registro neste mês.</p>
            )}
          </Bloco>
          <Bloco titulo="Imóvel">
            {d.financiamento ? (
              <>
                <div className="num font-display text-2xl font-semibold">{linhaImovel ? moeda(linhaImovel.parcela) : '—'}</div>
                <div className="mt-1 text-xs text-suave">
                  {linhaImovel ? `parcela ${linhaImovel.n} de ${d.tabela.length}` : 'sem parcela no mês'}
                </div>
                <div className="mt-1 text-xs text-suave">
                  saldo devedor {moeda(saldoImovel)} · {percentual(1 - saldoImovel / d.financiamento.valorFinanciado)} quitado
                </div>
              </>
            ) : (
              <p className="text-sm text-suave">Não cadastrado.</p>
            )}
          </Bloco>
          <Bloco titulo="Cartão">
            <div className="num font-display text-2xl font-semibold">{moeda(r.cartaoTotal)}</div>
            <div className="mt-1 text-xs text-suave">
              {moeda(r.cartaoParcelado)} em parcelas · {moeda(r.cartaoTotal - r.cartaoParcelado)} à vista
            </div>
            <div className="mt-1 text-xs text-suave">dívidas em aberto: {moeda(d.dividas.reduce((s, x) => s + x.saldo, 0))}</div>
          </Bloco>
        </div>

        {r.maiores.length > 0 && (
          <Bloco titulo="Maiores gastos">
            <table className="w-full text-sm">
              <tbody>
                {r.maiores.map((g, i) => (
                  <tr key={i} className="border-b border-linha last:border-0">
                    <td className="num w-16 py-1.5 text-suave">{rotuloData(g.data)}</td>
                    <td className="py-1.5">{g.descricao}</td>
                    <td className="hidden py-1.5 text-xs text-suave sm:table-cell">
                      {g.categoria} · {g.origem}
                    </td>
                    <td className="num w-28 py-1.5 text-right">{moeda(g.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Bloco>
        )}

        {parcelas.length > 0 && (
          <Bloco titulo="Parcelas já comprometidas nas próximas faturas">
            <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
              {parcelas.map(([m, v]) => (
                <div key={m} className="rounded-lg border border-linha p-2 text-center">
                  <div className="rotulo">{rotuloMes(m, true)}</div>
                  <div className="num text-sm font-semibold">{moeda(v)}</div>
                </div>
              ))}
            </div>
          </Bloco>
        )}

        <footer className="border-t border-linha pt-4 text-[11px] text-apagado">
          Gerado pelo Finanças com dados guardados só no seu aparelho. Cartão contado pela fatura do mês; pagamentos de fatura e aplicações não entram em gastos.
        </footer>
      </article>
    </div>
  )
}
