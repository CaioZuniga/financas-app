import { useState } from 'react'
import { GraficoLinha } from '../components/graficos'
import { IcLixo } from '../components/icones'
import { Botao, CabecalhoCard, Campo, Card, Chip, Legenda, Titulo, Vazio } from '../components/ui'
import { db } from '../db'
import { valorRecorrente, type Recorrente } from '../engine/projecao'
import { useDados } from '../lib/dados'
import { mesAtual, moeda, rotuloMes } from '../lib/format'

const nova = (natureza: Recorrente['natureza']): Recorrente => ({ descricao: '', valor: 0, natureza, inicio: mesAtual(), reajusteAnual: 0 })

export default function Fluxo() {
  const d = useDados()
  const [form, setForm] = useState<Recorrente>(nova('entrada'))
  const [unica, setUnica] = useState(false)
  if (!d.carregado) return null

  const p = d.projecao
  const entradas = d.recorrentes.filter((r) => r.natureza === 'entrada')
  const saidas = d.recorrentes.filter((r) => r.natureza === 'saida')

  async function adicionar() {
    if (!form.descricao || form.valor <= 0) return
    await db.recorrentes.add({ ...form, fim: unica ? form.inicio : form.fim || undefined })
    setForm(nova(form.natureza))
  }

  const Lista = ({ itens, cor }: { itens: Recorrente[]; cor: string }) =>
    itens.length ? (
      <ul className="space-y-2">
        {itens.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-linha bg-white/[0.02] px-4 py-2.5">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{r.descricao}</div>
              <div className="text-xs text-suave">
                {r.fim === r.inicio ? `só em ${rotuloMes(r.inicio, true)}` : `desde ${rotuloMes(r.inicio, true)}${r.fim ? ` até ${rotuloMes(r.fim, true)}` : ''}`}
                {r.reajusteAnual > 0 && ` · +${(r.reajusteAnual * 100).toFixed(1)}%/ano`}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`num font-display font-semibold ${cor}`}>{moeda(valorRecorrente(r, d.hoje) || r.valor)}</span>
              <button className="cursor-pointer text-apagado hover:text-rosa" onClick={() => db.recorrentes.delete(r.id!)}>
                <IcLixo width={16} height={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-suave">Nada cadastrado.</p>
    )

  return (
    <div className="space-y-5">
      <Titulo titulo="Fluxo de caixa" sub="Receitas e contas fixas que alimentam a projeção de 12 meses" />

      <Card atraso={1}>
        <CabecalhoCard
          titulo="Saldo de cada mês"
          sub="Entradas menos todas as saídas (fixas, cartão, imóvel e dívidas)"
          acao={<Legenda itens={[{ cor: 'var(--color-neon)', rotulo: 'Saldo do mês' }, { cor: 'var(--color-violeta)', rotulo: 'Acumulado', tracejado: true }]} />}
        />
        <GraficoLinha
          rotulos={p.map((m) => rotuloMes(m.mes, true))}
          series={[
            { nome: 'Saldo do mês', cor: 'var(--color-neon)' },
            { nome: 'Acumulado', cor: 'var(--color-violeta)', tracejado: true },
          ]}
          valores={[p.map((m) => m.saldo), p.map((m) => m.acumulado)]}
          altura={240}
        />
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card atraso={2}>
          <CabecalhoCard titulo="Entradas" sub={`${moeda(p[0].entradas)} este mês`} />
          <Lista itens={entradas} cor="text-neon" />
        </Card>
        <Card atraso={3}>
          <CabecalhoCard titulo="Contas fixas" sub={`${moeda(p[0].fixas)} este mês`} />
          <Lista itens={saidas} cor="text-violeta" />
        </Card>
        <Card atraso={4} destaque>
          <CabecalhoCard titulo="Adicionar" />
          <div className="mb-3 flex flex-wrap gap-2">
            <Chip ativo={form.natureza === 'entrada'} onClick={() => setForm({ ...form, natureza: 'entrada' })}>
              Entrada
            </Chip>
            <Chip ativo={form.natureza === 'saida'} onClick={() => setForm({ ...form, natureza: 'saida' })}>
              Conta fixa
            </Chip>
            <Chip ativo={unica} onClick={() => setUnica(!unica)}>
              Só uma vez
            </Chip>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Descrição" className="col-span-2" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder={form.natureza === 'entrada' ? 'Salário, bônus, aluguel…' : 'Escola, condomínio…'} />
            <Campo rotulo="Valor mensal" type="number" sufixo="R$" value={form.valor || ''} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} />
            <Campo rotulo={unica ? 'Mês' : 'Começa em'} type="month" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} />
            {!unica && (
              <>
                <Campo rotulo="Termina em" type="month" value={form.fim ?? ''} onChange={(e) => setForm({ ...form, fim: e.target.value || undefined })} />
                <Campo rotulo="Reajuste" type="number" step="0.1" sufixo="%/ano" value={form.reajusteAnual ? +(form.reajusteAnual * 100).toFixed(2) : ''} onChange={(e) => setForm({ ...form, reajusteAnual: Number(e.target.value) / 100 })} />
              </>
            )}
          </div>
          <Botao variante="primario" className="mt-4 w-full" onClick={adicionar} disabled={!form.descricao || form.valor <= 0}>
            Adicionar
          </Botao>
        </Card>
      </div>

      <Card atraso={5} className="!p-0">
        <div className="p-5 pb-0">
          <CabecalhoCard titulo="Projeção detalhada" sub="Cartão em violeta claro = estimativa (média das últimas faturas + parcelas já compradas)" />
        </div>
        {p.length ? (
          <div className="rolagem-fina overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="rotulo text-left">
                  {['Mês', 'Entradas', 'Fixas', 'Cartão', 'Imóvel', 'Dívidas', 'Saldo', 'Acumulado'].map((h, i) => (
                    <th key={h} className={`py-2 font-normal ${i === 0 ? 'px-5' : 'px-3 text-right'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="num">
                {p.map((m) => (
                  <tr key={m.mes} className="border-t border-linha">
                    <td className="px-5 py-2">{rotuloMes(m.mes, true)}</td>
                    <td className="px-3 py-2 text-right text-neon">{moeda(m.entradas)}</td>
                    <td className="px-3 py-2 text-right text-suave">{moeda(m.fixas)}</td>
                    <td className={`px-3 py-2 text-right ${m.cartaoReal ? 'text-suave' : 'text-violeta/80'}`}>{moeda(m.cartao)}</td>
                    <td className="px-3 py-2 text-right text-suave">{moeda(m.financiamento)}</td>
                    <td className="px-3 py-2 text-right text-suave">{moeda(m.dividas)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${m.saldo >= 0 ? 'text-texto' : 'text-rosa'}`}>{moeda(m.saldo)}</td>
                    <td className={`px-3 py-2 text-right ${m.acumulado >= 0 ? 'text-suave' : 'text-rosa'}`}>{moeda(m.acumulado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Vazio titulo="Sem projeção" texto="Cadastre entradas e contas fixas." />
        )}
      </Card>
    </div>
  )
}
