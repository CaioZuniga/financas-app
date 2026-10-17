import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarrasCategoria, GraficoBarras } from '../components/graficos'
import { IcLixo } from '../components/icones'
import { Botao, CabecalhoCard, Card, Chip, Kpi, Selecao, Titulo, Vazio } from '../components/ui'
import { db, type Movimento } from '../db'
import { CATEGORIAS, chaveDescricao, NAO_CONSUMO, type Categoria } from '../engine/categorias'
import { porCategoria, useDados } from '../lib/dados'
import { moeda, rotuloData, rotuloMes } from '../lib/format'

export default function Conta() {
  const d = useDados()
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const [conta, setConta] = useState('todas')
  const [categoria, setCategoria] = useState<string | null>(null)
  if (!d.carregado) return null

  const meses = [...new Set(d.movimentos.map((m) => m.data.slice(0, 7)))].sort()
  if (!meses.length)
    return (
      <div>
        <Titulo titulo="Conta corrente" />
        <Vazio
          titulo="Nenhum extrato importado"
          texto="Importe o PDF do extrato para ver Pix, boletos e débitos que não passam pelo cartão."
          acao={
            <Link to="/importar">
              <Botao variante="primario">Importar extrato</Botao>
            </Link>
          }
        />
      </div>
    )

  const mes = escolhido ?? meses.at(-1)!
  const contas = [...new Set(d.movimentos.map((m) => m.conta))].sort()
  const daConta = d.movimentos.filter((m) => conta === 'todas' || m.conta === conta)
  const doMes = daConta.filter((m) => m.data.startsWith(mes))
  const validos = doMes.filter((m) => !m.ignorado)
  const entradas = validos.filter((m) => m.valor > 0).reduce((s, m) => s + m.valor, 0)
  const saidas = -validos.filter((m) => m.valor < 0).reduce((s, m) => s + m.valor, 0)
  const consumo = validos.filter((m) => m.valor < 0 && !NAO_CONSUMO.includes(m.categoria))
  const categorias = porCategoria(consumo.map((m) => ({ categoria: m.categoria, valor: -m.valor, ignorado: m.ignorado })))
  const lista = doMes.filter((m) => !categoria || m.categoria === categoria).sort((a, b) => b.data.localeCompare(a.data))

  const historico = meses.slice(-12)
  const somaMes = (m: string, sinal: 1 | -1) =>
    daConta.filter((x) => !x.ignorado && x.data.startsWith(m) && Math.sign(x.valor) === sinal).reduce((s, x) => s + Math.abs(x.valor), 0)

  async function recategorizar(m: Movimento, nova: Categoria) {
    const padrao = chaveDescricao(m.descricao)
    await db.transaction('rw', db.movimentos, db.regras, async () => {
      if (padrao.length >= 3) {
        await db.regras.where('padrao').equals(padrao).delete()
        await db.regras.add({ padrao, categoria: nova })
        const iguais = await db.movimentos.filter((x) => chaveDescricao(x.descricao) === padrao).primaryKeys()
        await Promise.all(iguais.map((id) => db.movimentos.update(id, { categoria: nova })))
      } else await db.movimentos.update(m.id!, { categoria: nova })
    })
  }

  async function apagarMes() {
    if (!window.confirm(`Apagar os movimentos de ${rotuloMes(mes, true)}${conta !== 'todas' ? ` da conta ${conta}` : ''}? Essa ação não tem volta.`)) return
    await db.movimentos.bulkDelete(doMes.map((m) => m.id!))
    setEscolhido(null)
  }

  return (
    <div className="space-y-5">
      <Titulo
        titulo="Conta corrente"
        sub={`${meses.length} meses · ${contas.join(', ')}`}
        acao={
          <div className="flex gap-2">
            <Link to="/importar">
              <Botao variante="primario">Importar</Botao>
            </Link>
            <Botao variante="perigo" onClick={apagarMes} title="Apagar movimentos do mês">
              <IcLixo width={16} height={16} />
            </Botao>
          </div>
        }
      />

      <div className="rolagem-fina flex gap-2 overflow-x-auto pb-1">
        {meses.map((m) => (
          <Chip key={m} ativo={m === mes} onClick={() => setEscolhido(m)}>
            {rotuloMes(m, true)}
          </Chip>
        ))}
        <span className="mx-1 w-px shrink-0 bg-linha" />
        {['todas', ...contas].map((n) => (
          <Chip key={n} ativo={n === conta} onClick={() => setConta(n)}>
            {n === 'todas' ? 'Todas as contas' : n}
          </Chip>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        <Kpi rotulo="Entradas" valor={moeda(entradas)} tom="neon" />
        <Kpi rotulo="Saídas" valor={moeda(saidas)} tom="violeta" atraso={1} />
        <Kpi rotulo="Resultado" valor={moeda(entradas - saidas)} tom={entradas - saidas >= 0 ? 'neon' : 'rosa'} atraso={2} />
        <Kpi
          rotulo="Consumo fora do cartão"
          valor={moeda(consumo.reduce((s, m) => s - m.valor, 0))}
          tom="ambar"
          atraso={3}
          detalhe="sem fatura, investimentos e receitas"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Card atraso={2}>
          <CabecalhoCard titulo="Para onde foi" sub="Saídas de consumo · clique para filtrar" acao={categoria && <Chip ativo onClick={() => setCategoria(null)}>{categoria} ✕</Chip>} />
          {categorias.length ? (
            <BarrasCategoria itens={categorias} onClick={(c) => setCategoria(c === categoria ? null : c)} />
          ) : (
            <p className="text-sm text-suave">Nenhuma saída de consumo neste mês.</p>
          )}
        </Card>
        <Card atraso={3}>
          <CabecalhoCard
            titulo="Entradas × saídas"
            sub="Por mês, na conta"
          />
          <GraficoBarras
            rotulos={historico.map((m) => rotuloMes(m))}
            series={[
              { nome: 'Entradas', cor: 'var(--color-neon)' },
              { nome: 'Saídas', cor: 'var(--color-violeta)' },
            ]}
            valores={[historico.map((m) => somaMes(m, 1)), historico.map((m) => somaMes(m, -1))]}
            altura={260}
          />
        </Card>
      </div>

      <Card atraso={4} className="!p-0">
        <div className="p-5 pb-0">
          <CabecalhoCard titulo="Movimentos" sub="Pagamento de fatura fica em “Pagamentos” para não contar duas vezes com o cartão" />
        </div>
        <div className="rolagem-fina overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="rotulo text-left">
                <th className="px-5 py-2 font-normal">Data</th>
                <th className="px-3 py-2 font-normal">Descrição</th>
                <th className="px-3 py-2 font-normal">Conta</th>
                <th className="px-3 py-2 font-normal">Categoria</th>
                <th className="px-3 py-2 text-right font-normal">Valor</th>
                <th className="px-5 py-2 text-right font-normal">Conta?</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((m) => (
                <tr key={m.id} className={`border-t border-linha transition hover:bg-white/[0.02] ${m.ignorado ? 'opacity-40' : ''}`}>
                  <td className="num px-5 py-2 whitespace-nowrap text-suave">{rotuloData(m.data)}</td>
                  <td className="px-3 py-2">{m.descricao}</td>
                  <td className="px-3 py-2 text-suave">{m.conta}</td>
                  <td className="px-3 py-2">
                    <Selecao value={m.categoria} onChange={(e) => recategorizar(m, e.target.value as Categoria)} className="min-w-36">
                      {CATEGORIAS.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </Selecao>
                  </td>
                  <td className={`num px-3 py-2 text-right whitespace-nowrap ${m.valor > 0 ? 'text-neon' : ''}`}>{moeda(m.valor)}</td>
                  <td className="px-5 py-2 text-right">
                    <input type="checkbox" className="accent-[var(--color-neon)]" checked={!m.ignorado} onChange={(e) => db.movimentos.update(m.id!, { ignorado: e.target.checked ? 0 : 1 })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
