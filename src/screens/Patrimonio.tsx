import { useState } from 'react'
import { BarrasCategoria, Faisca, GraficoLinha } from '../components/graficos'
import { IcLixo } from '../components/icones'
import { Botao, CabecalhoCard, Campo, Card, Legenda, Selecao, Titulo, Vazio } from '../components/ui'
import { db } from '../db'
import { TIPOS_ATIVO, type Ativo, type TipoAtivo } from '../engine/patrimonio'
import { useDados, useRegistrarSnapshot } from '../lib/dados'
import { moeda, moedaCurta, rotuloMes } from '../lib/format'

const COR_TIPO: Record<TipoAtivo, string> = {
  conta: 'var(--color-s1)',
  investimento: 'var(--color-s3)',
  imovel: 'var(--color-s4)',
  veiculo: 'var(--color-s2)',
  outro: '#6b7180',
}
const RENDIMENTO_PADRAO: Record<TipoAtivo, number> = { conta: 0, investimento: 0.11, imovel: 0.05, veiculo: -0.1, outro: 0 }
const hojeISO = () => new Date().toISOString().slice(0, 10)
const NOVO = (): Ativo => ({ nome: '', tipo: 'investimento', valor: 0, rendimentoAnual: RENDIMENTO_PADRAO.investimento, atualizadoEm: hojeISO() })

export default function Patrimonio() {
  const d = useDados()
  const [novo, setNovo] = useState<Ativo>(NOVO())
  useRegistrarSnapshot(d)
  if (!d.carregado) return null

  const p = d.patrimonio
  const proj = d.projecaoPatrimonio
  const historico = d.snapshots.filter((s) => s.mes < d.hoje)
  const pontos = [...historico, ...proj]
  const final = proj.at(-1)
  const temImovelAtivo = d.ativos.some((a) => a.tipo === 'imovel')
  const diasDesde = (iso: string) => Math.floor((Date.now() - new Date(iso + 'T12:00:00').getTime()) / 86400000)

  async function adicionar() {
    if (!novo.nome || novo.valor <= 0) return
    await db.ativos.add({ ...novo, atualizadoEm: hojeISO() })
    setNovo(NOVO())
  }

  return (
    <div className="space-y-5">
      <Titulo titulo="Patrimônio" sub="Tudo o que você tem menos tudo o que deve. Atualize os valores de vez em quando." />

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <Card destaque className="overflow-hidden !p-6">
          <div className="pointer-events-none absolute -top-24 -left-24 size-64 rounded-full bg-violeta/10 blur-3xl" />
          <div className="rotulo">Patrimônio líquido hoje</div>
          <div className={`num mt-2 font-display text-[clamp(2.1rem,5vw,3.4rem)] leading-none font-bold tracking-tight ${p.liquido >= 0 ? 'texto-neon' : 'text-rosa'}`}>
            {moeda(p.liquido)}
          </div>
          {final && (
            <p className="mt-3 text-sm text-suave">
              Em {rotuloMes(final.mes, true)}, no ritmo atual: <b className="text-texto">{moeda(final.liquido)}</b>{' '}
              <span className={final.liquido - p.liquido >= 0 ? 'text-neon' : 'text-rosa'}>
                ({final.liquido - p.liquido >= 0 ? '+' : ''}
                {moedaCurta(final.liquido - p.liquido)})
              </span>
            </p>
          )}
          <div className="mt-4">
            <Faisca valores={[p.liquido, ...proj.map((s) => s.liquido)]} cor="var(--color-violeta)" altura={60} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-linha bg-white/[0.02] p-3">
              <div className="rotulo">Ativos</div>
              <div className="num mt-1 font-display text-lg font-semibold">{moeda(p.ativos)}</div>
            </div>
            <div className="rounded-xl border border-linha bg-white/[0.02] p-3">
              <div className="rotulo">Passivos</div>
              <div className="num mt-1 font-display text-lg font-semibold text-rosa">{moeda(p.passivos)}</div>
            </div>
          </div>
        </Card>

        <Card atraso={1}>
          <CabecalhoCard titulo="Composição" sub="Ativos por tipo" />
          {p.porTipo.length ? (
            <BarrasCategoria itens={p.porTipo.map((t) => ({ rotulo: t.rotulo, valor: t.valor, cor: COR_TIPO[t.tipo] }))} />
          ) : (
            <Vazio titulo="Sem ativos" texto="Cadastre conta, investimentos, imóveis e veículos abaixo." />
          )}
          <div className="mt-5 space-y-2 border-t border-linha pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-suave">Saldo devedor do imóvel</span>
              <span className="num">{moeda(p.saldoImovel)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-suave">Dívidas</span>
              <span className="num">{moeda(p.dividas)}</span>
            </div>
          </div>
        </Card>
      </div>

      {d.financiamento && !temImovelAtivo && (
        <div className="entrar flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ambar/30 bg-ambar/5 px-5 py-4 text-sm">
          <span>
            Você tem financiamento, mas o imóvel não está nos ativos. Sem ele, o patrimônio aparece mais baixo do que é.
          </span>
          <Botao onClick={() => setNovo({ ...NOVO(), nome: 'Imóvel financiado', tipo: 'imovel', rendimentoAnual: RENDIMENTO_PADRAO.imovel })}>
            Adicionar imóvel
          </Botao>
        </div>
      )}

      <Card atraso={2}>
        <CabecalhoCard
          titulo="Evolução"
          sub={historico.length ? `${historico.length} meses registrados + projeção de 12 meses` : 'Projeção de 12 meses (o histórico começa a ser gravado a partir de hoje)'}
          acao={
            <Legenda
              itens={[
                { cor: 'var(--color-neon)', rotulo: 'Líquido' },
                { cor: 'var(--color-violeta)', rotulo: 'Ativos' },
                { cor: 'var(--color-rosa)', rotulo: 'Passivos', tracejado: true },
              ]}
            />
          }
        />
        <GraficoLinha
          rotulos={pontos.map((s) => rotuloMes(s.mes, true))}
          series={[
            { nome: 'Líquido', cor: 'var(--color-neon)' },
            { nome: 'Ativos', cor: 'var(--color-violeta)' },
            { nome: 'Passivos', cor: 'var(--color-rosa)', tracejado: true },
          ]}
          valores={[pontos.map((s) => s.liquido), pontos.map((s) => s.ativos), pontos.map((s) => s.passivos)]}
          altura={260}
        />
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card atraso={3} className="!p-0">
          <div className="p-5 pb-0">
            <CabecalhoCard titulo="Seus ativos" sub="Clique no valor para atualizar" />
          </div>
          {d.ativos.length ? (
            <div className="rolagem-fina overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="rotulo text-left">
                    <th className="px-5 py-2 font-normal">Ativo</th>
                    <th className="px-3 py-2 font-normal">Tipo</th>
                    <th className="px-3 py-2 text-right font-normal">Valor</th>
                    <th className="px-3 py-2 text-right font-normal">% a.a.</th>
                    <th className="px-5 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {d.ativos.map((a) => {
                    const dias = diasDesde(a.atualizadoEm)
                    return (
                      <tr key={a.id} className="border-t border-linha">
                        <td className="px-5 py-2">
                          <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full" style={{ background: COR_TIPO[a.tipo] }} />
                            {a.nome}
                          </div>
                          <div className={`text-[11px] ${dias > 45 ? 'text-ambar' : 'text-apagado'}`}>
                            {dias === 0 ? 'atualizado hoje' : `atualizado há ${dias} dias`}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-suave">{TIPOS_ATIVO.find((t) => t.tipo === a.tipo)?.rotulo}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            className="campo num w-36 !py-1 text-right"
                            type="number"
                            defaultValue={a.valor}
                            key={a.valor}
                            onBlur={(e) => {
                              const v = Number(e.target.value)
                              if (v >= 0 && v !== a.valor) db.ativos.update(a.id!, { valor: v, atualizadoEm: hojeISO() })
                            }}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            className="campo num w-20 !py-1 text-right"
                            type="number"
                            step="0.1"
                            defaultValue={+(a.rendimentoAnual * 100).toFixed(2)}
                            onBlur={(e) => db.ativos.update(a.id!, { rendimentoAnual: Number(e.target.value) / 100 })}
                          />
                        </td>
                        <td className="px-5 py-2 text-right">
                          <button className="cursor-pointer text-apagado hover:text-rosa" onClick={() => db.ativos.delete(a.id!)}>
                            <IcLixo width={16} height={16} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-5 pt-0">
              <Vazio titulo="Nenhum ativo" texto="Comece pelo saldo da conta e pelos investimentos." />
            </div>
          )}
        </Card>

        <Card atraso={4} destaque>
          <CabecalhoCard titulo="Adicionar ativo" />
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Nome" className="col-span-2" value={novo.nome} placeholder="CDB XP, Apartamento, Carro…" onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
            <Selecao
              rotulo="Tipo"
              value={novo.tipo}
              onChange={(e) => {
                const tipo = e.target.value as TipoAtivo
                setNovo({ ...novo, tipo, rendimentoAnual: RENDIMENTO_PADRAO[tipo] })
              }}
            >
              {TIPOS_ATIVO.map((t) => (
                <option key={t.tipo} value={t.tipo}>
                  {t.rotulo}
                </option>
              ))}
            </Selecao>
            <Campo rotulo="Valor atual" type="number" sufixo="R$" value={novo.valor || ''} onChange={(e) => setNovo({ ...novo, valor: Number(e.target.value) })} />
            <Campo
              rotulo={novo.tipo === 'veiculo' ? 'Depreciação' : 'Rendimento'}
              type="number"
              step="0.1"
              sufixo="% a.a."
              className="col-span-2"
              value={+(novo.rendimentoAnual * 100).toFixed(2)}
              onChange={(e) => setNovo({ ...novo, rendimentoAnual: Number(e.target.value) / 100 })}
            />
          </div>
          <Botao variante="primario" className="mt-4 w-full" onClick={adicionar} disabled={!novo.nome || novo.valor <= 0}>
            Adicionar
          </Botao>
          <p className="mt-3 text-xs text-apagado">A sobra de caixa projetada em Fluxo entra como dinheiro em conta na projeção.</p>
        </Card>
      </div>
    </div>
  )
}
