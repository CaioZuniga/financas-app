import { useEffect, useMemo, useRef, useState } from 'react'
import { GraficoLinha } from '../components/graficos'
import { IcLixo } from '../components/icones'
import { Botao, CabecalhoCard, Campo, Card, Kpi, Legenda, Selecao, Titulo, Vazio } from '../components/ui'
import { db, salvarFinanciamento } from '../db'
import { resumir, tabelaSAC, type Amortizacao, type Financiamento } from '../engine/financiamento'
import { useDados } from '../lib/dados'
import { difMeses, mesAtual, moeda, moedaCurta, rotuloMes } from '../lib/format'

const PADRAO: Financiamento = {
  valorFinanciado: 500000,
  taxaAnual: 0.1149,
  prazoMeses: 360,
  inicio: mesAtual(),
  trMensal: 0.0017,
  seguroMensal: 150,
  taxaAdmMensal: 25,
  amortizacoes: [],
}

export default function Imovel() {
  const d = useDados()
  const [f, setF] = useState<Financiamento | null>(null)
  const [nova, setNova] = useState<Amortizacao>({ aposParcela: 0, valor: 50000, modo: 'prazo' })
  // Só grava depois que o usuário mexe: abrir a tela não cria um contrato de exemplo.
  const alterado = useRef(false)
  const [cadastrando, setCadastrando] = useState(false)

  useEffect(() => {
    if (d.carregado && f === null) setF(d.financiamento ?? PADRAO)
  }, [d.carregado, d.financiamento, f])

  // Salva sozinho 400 ms depois da última mudança.
  useEffect(() => {
    if (!f || !alterado.current) return
    const t = setTimeout(() => salvarFinanciamento(f), 400)
    return () => clearTimeout(t)
  }, [f])

  const tabela = useMemo(() => (f ? tabelaSAC(f) : []), [f])
  const semExtra = useMemo(() => (f ? tabelaSAC({ ...f, amortizacoes: [] }) : []), [f])
  if (!f) return null

  if (!d.financiamento && !cadastrando)
    return (
      <div className="space-y-5">
        <Titulo titulo="Financiamento imobiliário" sub="SAC com correção do saldo pela TR." />
        <Card destaque>
          <Vazio
            titulo="Nenhum financiamento cadastrado"
            texto="Se você tem um financiamento imobiliário, cadastre o contrato para ver saldo devedor, juros a pagar e simular amortizações."
            acao={
              <Botao variante="primario" onClick={() => setCadastrando(true)}>
                Cadastrar financiamento
              </Botao>
            }
          />
        </Card>
      </div>
    )

  async function remover() {
    if (!window.confirm('Remover o financiamento? A tabela, as amortizações simuladas e a parcela na projeção somem.')) return
    alterado.current = false
    await db.config.delete('financiamento')
    setCadastrando(false)
    setF(PADRAO)
  }

  const set = <K extends keyof Financiamento>(k: K, v: Financiamento[K]) => {
    alterado.current = true
    setF({ ...f, [k]: v })
  }
  const hoje = d.hoje
  const nHoje = Math.max(1, difMeses(f.inicio, hoje) + 1)
  const linhaHoje = tabela.find((l) => l.mes === hoje)
  const saldoHoje = tabela.filter((l) => difMeses(l.mes, hoje) >= 0).at(-1)?.saldoFinal ?? f.valorFinanciado
  const r = resumir(tabela)
  const r0 = resumir(semExtra)
  const jurosRestantes = tabela.filter((l) => difMeses(hoje, l.mes) >= 0).reduce((s, l) => s + l.juros, 0)

  // Gráfico anual (pontos de 12 em 12 meses) para não pesar com 360 pontos.
  const pontos = semExtra.filter((_, i) => i % 12 === 0)
  const rotulos = pontos.map((l) => rotuloMes(l.mes, true))
  const saldoCom = pontos.map((l) => tabela.find((x) => x.n === l.n)?.saldoInicial ?? 0)
  const saldoSem = pontos.map((l) => l.saldoInicial)
  const temExtra = f.amortizacoes.length > 0

  const proximas = tabela.filter((l) => difMeses(hoje, l.mes) >= 0).slice(0, 12)

  return (
    <div className="space-y-5">
      <Titulo titulo="Financiamento imobiliário" sub="SAC com correção do saldo pela TR. Os dados são salvos automaticamente." />

      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        <Kpi rotulo="Parcela deste mês" valor={linhaHoje ? moeda(linhaHoje.parcela) : '—'} tom="ambar" detalhe={linhaHoje ? `${linhaHoje.n}ª de ${tabela.length}` : 'fora do contrato'} />
        <Kpi rotulo="Saldo devedor" valor={moedaCurta(saldoHoje)} tom="violeta" atraso={1} detalhe={`${((1 - saldoHoje / f.valorFinanciado) * 100).toFixed(1)}% quitado`} />
        <Kpi rotulo="Juros a pagar" valor={moedaCurta(jurosRestantes)} tom="rosa" atraso={2} detalhe={`total do contrato: ${moedaCurta(r.totalJuros)}`} />
        <Kpi rotulo="Última parcela" valor={r.ultimaParcela ? rotuloMes(r.ultimaParcela, true) : '—'} tom="neon" atraso={3} detalhe={`${tabela.filter((l) => difMeses(hoje, l.mes) >= 0).length} parcelas restantes`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.5fr]">
        <Card atraso={2}>
          <CabecalhoCard
            titulo="Contrato"
            sub="Não tem os dados originais? Use o saldo devedor de hoje, as parcelas que faltam e a próxima parcela como 1ª."
            acao={
              d.financiamento && (
                <button className="cursor-pointer text-apagado hover:text-rosa" onClick={remover} title="Remover financiamento">
                  <IcLixo width={16} height={16} />
                </button>
              )
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Valor financiado" type="number" value={f.valorFinanciado} sufixo="R$" onChange={(e) => set('valorFinanciado', Number(e.target.value))} className="col-span-2" />
            <Campo rotulo="Juros efetivos" type="number" step="0.01" value={+(f.taxaAnual * 100).toFixed(4)} sufixo="% a.a." onChange={(e) => set('taxaAnual', Number(e.target.value) / 100)} />
            <Campo rotulo="Prazo" type="number" value={f.prazoMeses} sufixo="meses" onChange={(e) => set('prazoMeses', Math.max(1, Number(e.target.value)))} />
            <Campo rotulo="1ª parcela" type="month" value={f.inicio} onChange={(e) => e.target.value && set('inicio', e.target.value)} />
            <Campo rotulo="TR estimada" type="number" step="0.01" value={+(f.trMensal * 100).toFixed(4)} sufixo="% a.m." onChange={(e) => set('trMensal', Number(e.target.value) / 100)} />
            <Campo rotulo="Seguros (MIP+DFI)" type="number" value={f.seguroMensal} sufixo="R$" onChange={(e) => set('seguroMensal', Number(e.target.value))} />
            <Campo rotulo="Taxa adm." type="number" value={f.taxaAdmMensal} sufixo="R$" onChange={(e) => set('taxaAdmMensal', Number(e.target.value))} />
          </div>
        </Card>

        <Card atraso={3}>
          <CabecalhoCard
            titulo="Saldo devedor"
            sub="No início de cada ano do contrato"
            acao={
              temExtra && (
                <Legenda
                  itens={[
                    { cor: 'var(--color-neon)', rotulo: 'Com amortizações' },
                    { cor: 'var(--color-suave)', rotulo: 'Sem', tracejado: true },
                  ]}
                />
              )
            }
          />
          <GraficoLinha
            rotulos={rotulos}
            series={temExtra ? [{ nome: 'Com amortizações', cor: 'var(--color-neon)' }, { nome: 'Sem amortizações', cor: 'var(--color-suave)', tracejado: true }] : [{ nome: 'Saldo devedor', cor: 'var(--color-neon)' }]}
            valores={temExtra ? [saldoCom, saldoSem] : [saldoSem]}
            altura={280}
          />
        </Card>
      </div>

      <Card atraso={4} destaque>
        <CabecalhoCard titulo="Simular amortização extra" sub="Abater prazo economiza mais juros; abater parcela alivia o caixa mensal" />
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <Campo rotulo="Após a parcela nº" type="number" value={nova.aposParcela || nHoje} onChange={(e) => setNova({ ...nova, aposParcela: Number(e.target.value) })} />
          <Campo rotulo="Valor" type="number" value={nova.valor} sufixo="R$" onChange={(e) => setNova({ ...nova, valor: Number(e.target.value) })} />
          <Selecao rotulo="Reduzir" value={nova.modo} onChange={(e) => setNova({ ...nova, modo: e.target.value as Amortizacao['modo'] })}>
            <option value="prazo">Prazo</option>
            <option value="parcela">Parcela</option>
          </Selecao>
          <Botao variante="primario" onClick={() => set('amortizacoes', [...f.amortizacoes, { ...nova, aposParcela: nova.aposParcela || nHoje }].sort((a, b) => a.aposParcela - b.aposParcela))}>
            Adicionar
          </Botao>
        </div>

        {temExtra && (
          <>
            <ul className="mt-4 divide-y divide-linha rounded-xl border border-linha">
              {f.amortizacoes.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span>
                    <span className="num font-medium">{moeda(a.valor)}</span>
                    <span className="text-suave"> após a {a.aposParcela}ª parcela · reduz {a.modo}</span>
                  </span>
                  <button className="cursor-pointer text-apagado hover:text-rosa" onClick={() => set('amortizacoes', f.amortizacoes.filter((_, k) => k !== i))}>
                    <IcLixo width={16} height={16} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Destaque rotulo="Economia de juros" valor={moeda(r0.totalJuros - r.totalJuros)} />
              <Destaque rotulo="Meses a menos" valor={`${r0.meses - r.meses}`} />
              <Destaque rotulo="Novo fim" valor={rotuloMes(r.ultimaParcela, true)} />
            </div>
          </>
        )}
      </Card>

      <Card atraso={5} className="!p-0">
        <div className="p-5 pb-0">
          <CabecalhoCard titulo="Próximas 12 parcelas" />
        </div>
        <div className="rolagem-fina overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="rotulo text-left">
                {['Nº', 'Mês', 'Amortização', 'Juros', 'TR', 'Encargos', 'Parcela', 'Saldo após'].map((h, i) => (
                  <th key={h} className={`py-2 font-normal ${i === 0 ? 'px-5' : 'px-3'} ${i > 1 ? 'text-right' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="num">
              {proximas.map((l) => (
                <tr key={l.n} className="border-t border-linha">
                  <td className="px-5 py-2 text-suave">{l.n}</td>
                  <td className="px-3 py-2">{rotuloMes(l.mes, true)}</td>
                  <td className="px-3 py-2 text-right">{moeda(l.amortizacao)}</td>
                  <td className="px-3 py-2 text-right text-suave">{moeda(l.juros)}</td>
                  <td className="px-3 py-2 text-right text-suave">{moeda(l.correcaoTR)}</td>
                  <td className="px-3 py-2 text-right text-suave">{moeda(l.encargos)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{moeda(l.parcela)}</td>
                  <td className="px-3 py-2 text-right text-suave">{moeda(l.saldoFinal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function Destaque({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-neon/20 bg-neon/5 p-4">
      <div className="rotulo">{rotulo}</div>
      <div className="num mt-1 font-display text-xl font-semibold text-neon">{valor}</div>
    </div>
  )
}
