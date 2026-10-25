import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IcCadeado, IcLixo, IcSoma } from '../components/icones'
import { Botao, Campo, Chip } from '../components/ui'
import { concluirAssistente, db, salvarFinanciamento } from '../db'
import type { Ativo } from '../engine/patrimonio'
import type { Recorrente } from '../engine/projecao'
import { mesAtual, moeda } from '../lib/format'

interface Linha {
  nome: string
  valor: number
}
interface LinhaCartao {
  nome: string
  limite: number
  dia: number
}
interface LinhaDivida {
  nome: string
  saldo: number
  juros: number
  parcela: number
}

const CONTAS_SUGERIDAS = ['Aluguel', 'Condomínio', 'IPTU', 'Escola', 'Plano de saúde', 'Internet', 'Celular', 'Luz', 'Água', 'Gás', 'Academia', 'Diarista', 'Seguro do carro']
const BANCOS = ['Nubank', 'C6', 'XP', 'Inter', 'Itaú', 'Bradesco', 'Santander', 'BB', 'Caixa']
const PASSOS = ['Início', 'Renda', 'Contas fixas', 'Cartões', 'Imóvel e dívidas', 'Patrimônio', 'Pronto']

const num = (v: string) => Number(v.replace(',', '.')) || 0

export default function Comecar() {
  const navegar = useNavigate()
  const [passo, setPasso] = useState(0)
  const [salvando, setSalvando] = useState(false)

  const [renda, setRenda] = useState<Linha[]>([{ nome: 'Salário líquido', valor: 0 }])
  const [reajuste, setReajuste] = useState(5)
  const [contas, setContas] = useState<Linha[]>([])
  const [cartoes, setCartoes] = useState<LinhaCartao[]>([])
  const [temImovel, setTemImovel] = useState(false)
  const [imovel, setImovel] = useState({ valor: 0, taxa: 11.49, prazo: 360, inicio: mesAtual(), tr: 0.17, seguro: 0 })
  const [dividas, setDividas] = useState<LinhaDivida[]>([])
  const [bens, setBens] = useState({ conta: 0, investimentos: 0, imovel: 0, veiculo: 0 })

  const totalRenda = renda.reduce((s, r) => s + r.valor, 0)
  const totalContas = contas.reduce((s, r) => s + r.valor, 0)
  const totalDividas = dividas.reduce((s, r) => s + r.parcela, 0)

  async function pularTudo() {
    await concluirAssistente()
    navegar('/')
  }

  async function salvar() {
    setSalvando(true)
    const inicio = mesAtual()
    const hoje = new Date().toISOString().slice(0, 10)
    const recorrentes: Recorrente[] = [
      ...renda.filter((r) => r.nome && r.valor > 0).map((r) => ({ descricao: r.nome, valor: r.valor, natureza: 'entrada' as const, inicio, reajusteAnual: reajuste / 100 })),
      ...contas.filter((r) => r.nome && r.valor > 0).map((r) => ({ descricao: r.nome, valor: r.valor, natureza: 'saida' as const, inicio, reajusteAnual: 0.05 })),
    ]
    const ativos: Ativo[] = [
      { nome: 'Conta corrente', tipo: 'conta' as const, valor: bens.conta, rendimentoAnual: 0, atualizadoEm: hoje },
      { nome: 'Investimentos', tipo: 'investimento' as const, valor: bens.investimentos, rendimentoAnual: 0.1, atualizadoEm: hoje },
      { nome: 'Imóvel', tipo: 'imovel' as const, valor: bens.imovel, rendimentoAnual: 0.05, atualizadoEm: hoje },
      { nome: 'Veículo', tipo: 'veiculo' as const, valor: bens.veiculo, rendimentoAnual: -0.1, atualizadoEm: hoje },
    ].filter((a) => a.valor > 0)

    await db.transaction('rw', [db.recorrentes, db.cartoes, db.dividas, db.ativos, db.config], async () => {
      await db.recorrentes.bulkAdd(recorrentes)
      for (const c of cartoes.filter((c) => c.nome))
        if (!(await db.cartoes.where('nome').equals(c.nome).first())) await db.cartoes.add({ nome: c.nome, limite: c.limite, diaVencimento: c.dia || 10 })
      await db.dividas.bulkAdd(
        dividas.filter((x) => x.nome && x.saldo > 0).map((x) => ({ nome: x.nome, credor: '', saldo: x.saldo, taxaMensal: x.juros / 100, parcelaMinima: x.parcela })),
      )
      await db.ativos.bulkAdd(ativos)
      if (temImovel && imovel.valor > 0)
        await salvarFinanciamento({
          valorFinanciado: imovel.valor,
          taxaAnual: imovel.taxa / 100,
          prazoMeses: imovel.prazo,
          inicio: imovel.inicio,
          trMensal: imovel.tr / 100,
          seguroMensal: imovel.seguro,
          taxaAdmMensal: 25,
          amortizacoes: [],
        })
      await concluirAssistente()
    })
    setSalvando(false)
    navegar('/')
  }

  return (
    <div className="mx-auto max-w-2xl">
      {passo > 0 && (
        <div className="entrar mb-6">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="rotulo">
              Passo {passo} de {PASSOS.length - 1} · {PASSOS[passo]}
            </span>
            <button className="cursor-pointer text-apagado hover:text-texto" onClick={pularTudo}>
              Pular assistente
            </button>
          </div>
          <div className="flex gap-1.5">
            {PASSOS.slice(1).map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition ${i < passo ? 'bg-neon shadow-[0_0_8px_var(--color-neon)]' : 'bg-white/[0.08]'}`} />
            ))}
          </div>
        </div>
      )}

      <div key={passo} className="entrar">
        {passo === 0 && (
          <div className="py-6 md:py-12">
            <div className="rotulo">primeiro acesso</div>
            <h1 className="mt-2 font-display text-4xl leading-[1.05] font-bold tracking-tight md:text-6xl">
              Tudo o que entra, sai e <span className="texto-neon">ainda vai sair</span>.
            </h1>
            <p className="mt-4 max-w-xl text-suave">
              Em 3 minutos o app aprende o básico da sua vida financeira: renda, contas fixas, cartões, imóvel, dívidas e patrimônio. Tudo pode ser pulado e
              editado depois.
            </p>
            <div className="mt-6 flex items-start gap-2 rounded-xl border border-linha p-3 text-sm text-suave">
              <IcCadeado className="mt-0.5 shrink-0 text-neon" width={15} height={15} />
              Os dados ficam só neste aparelho. Nada vai para servidor, a não ser o backup criptografado no seu Google Drive, se você ligar.
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Botao variante="primario" onClick={() => setPasso(1)}>
                Começar do zero
              </Botao>
              <Link to="/ajustes" onClick={() => concluirAssistente()}>
                <Botao>Já uso em outro aparelho</Botao>
              </Link>
            </div>
            <p className="mt-3 text-xs text-apagado">“Já uso em outro aparelho” leva para Ajustes, onde você sincroniza com o Drive ou restaura um backup.</p>
          </div>
        )}

        {passo === 1 && (
          <Passo titulo="Quanto entra por mês?" sub="Valores líquidos, que caem na conta. Salário, pró-labore, aluguel recebido, pensão…">
            <ListaValores linhas={renda} setLinhas={setRenda} placeholder="Ex.: Aluguel recebido" novo="Outra renda" />
            <div className="mt-4 max-w-56">
              <Campo rotulo="Reajuste anual esperado" type="number" step="0.5" sufixo="% a.a." value={reajuste} onChange={(e) => setReajuste(num(e.target.value))} />
            </div>
            <Total rotulo="Renda mensal" valor={totalRenda} />
          </Passo>
        )}

        {passo === 2 && (
          <Passo titulo="Quais contas fixas você paga?" sub="Toque nas que você tem e coloque o valor mensal. O cartão de crédito fica de fora: ele vem pelas faturas.">
            <div className="mb-4 flex flex-wrap gap-2">
              {CONTAS_SUGERIDAS.map((c) => {
                const ativo = contas.some((x) => x.nome === c)
                return (
                  <Chip key={c} ativo={ativo} onClick={() => setContas(ativo ? contas.filter((x) => x.nome !== c) : [...contas, { nome: c, valor: 0 }])}>
                    {ativo ? '✓ ' : '+ '}
                    {c}
                  </Chip>
                )
              })}
            </div>
            <ListaValores linhas={contas} setLinhas={setContas} placeholder="Outra conta fixa" novo="Outra conta" />
            <Total rotulo="Contas fixas por mês" valor={totalContas} />
          </Passo>
        )}

        {passo === 3 && (
          <Passo titulo="Quais cartões de crédito você usa?" sub="Os gastos chegam depois, importando o PDF da fatura. Aqui é só para saber limite e vencimento.">
            <div className="mb-4 flex flex-wrap gap-2">
              {BANCOS.map((b) => {
                const ativo = cartoes.some((x) => x.nome === b)
                return (
                  <Chip key={b} ativo={ativo} onClick={() => setCartoes(ativo ? cartoes.filter((x) => x.nome !== b) : [...cartoes, { nome: b, limite: 0, dia: 10 }])}>
                    {ativo ? '✓ ' : '+ '}
                    {b}
                  </Chip>
                )
              })}
            </div>
            <div className="space-y-2">
              {cartoes.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_5.5rem_3.75rem_auto] items-end gap-2 sm:grid-cols-[1fr_7rem_5rem_auto]">
                  <Campo rotulo={i === 0 ? 'Cartão' : ''} value={c.nome} onChange={(e) => setCartoes(cartoes.map((x, k) => (k === i ? { ...x, nome: e.target.value } : x)))} />
                  <Campo rotulo={i === 0 ? 'Limite' : ''} type="number" value={c.limite || ''} onChange={(e) => setCartoes(cartoes.map((x, k) => (k === i ? { ...x, limite: num(e.target.value) } : x)))} />
                  <Campo rotulo={i === 0 ? 'Vence dia' : ''} type="number" min={1} max={31} value={c.dia || ''} onChange={(e) => setCartoes(cartoes.map((x, k) => (k === i ? { ...x, dia: num(e.target.value) } : x)))} />
                  <Remover onClick={() => setCartoes(cartoes.filter((_, k) => k !== i))} />
                </div>
              ))}
            </div>
            <Adicionar onClick={() => setCartoes([...cartoes, { nome: '', limite: 0, dia: 10 }])}>Outro cartão</Adicionar>
          </Passo>
        )}

        {passo === 4 && (
          <Passo titulo="Imóvel financiado e dívidas" sub="Empréstimos, financiamento de carro, cheque especial. O cartão não entra aqui.">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-linha bg-white/[0.02] p-3 text-sm">
              <input type="checkbox" className="accent-[var(--color-neon)]" checked={temImovel} onChange={(e) => setTemImovel(e.target.checked)} />
              Tenho financiamento imobiliário (SAC + TR)
            </label>
            {temImovel && (
              <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-linha p-4 sm:grid-cols-3">
                <Campo rotulo="Valor financiado" type="number" sufixo="R$" className="col-span-2 sm:col-span-1" value={imovel.valor || ''} onChange={(e) => setImovel({ ...imovel, valor: num(e.target.value) })} />
                <Campo rotulo="Juros" type="number" step="0.01" sufixo="% a.a." value={imovel.taxa} onChange={(e) => setImovel({ ...imovel, taxa: num(e.target.value) })} />
                <Campo rotulo="Prazo" type="number" sufixo="meses" value={imovel.prazo} onChange={(e) => setImovel({ ...imovel, prazo: num(e.target.value) })} />
                <Campo rotulo="1ª parcela" type="month" value={imovel.inicio} onChange={(e) => e.target.value && setImovel({ ...imovel, inicio: e.target.value })} />
                <Campo rotulo="TR estimada" type="number" step="0.01" sufixo="% a.m." value={imovel.tr} onChange={(e) => setImovel({ ...imovel, tr: num(e.target.value) })} />
                <Campo rotulo="Seguros/mês" type="number" sufixo="R$" value={imovel.seguro || ''} onChange={(e) => setImovel({ ...imovel, seguro: num(e.target.value) })} />
                <p className="col-span-full text-xs text-apagado">Não tem os dados do contrato à mão? Use o saldo devedor de hoje, as parcelas que faltam e a próxima parcela como 1ª.</p>
              </div>
            )}

            <div className="mt-6 space-y-2">
              {dividas.map((x, i) => (
                <div key={i} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_7rem_5.5rem_7rem_auto]">
                  <Campo rotulo={i === 0 ? 'Dívida' : ''} className="col-span-2 sm:col-span-1" value={x.nome} placeholder="Empréstimo, carro…" onChange={(e) => setDividas(dividas.map((y, k) => (k === i ? { ...y, nome: e.target.value } : y)))} />
                  <Campo rotulo={i === 0 ? 'Saldo' : ''} type="number" value={x.saldo || ''} onChange={(e) => setDividas(dividas.map((y, k) => (k === i ? { ...y, saldo: num(e.target.value) } : y)))} />
                  <Campo rotulo={i === 0 ? '% a.m.' : ''} type="number" step="0.01" value={x.juros || ''} onChange={(e) => setDividas(dividas.map((y, k) => (k === i ? { ...y, juros: num(e.target.value) } : y)))} />
                  <Campo rotulo={i === 0 ? 'Parcela' : ''} type="number" value={x.parcela || ''} onChange={(e) => setDividas(dividas.map((y, k) => (k === i ? { ...y, parcela: num(e.target.value) } : y)))} />
                  <Remover onClick={() => setDividas(dividas.filter((_, k) => k !== i))} />
                </div>
              ))}
            </div>
            <Adicionar onClick={() => setDividas([...dividas, { nome: '', saldo: 0, juros: 2, parcela: 0 }])}>{dividas.length ? 'Outra dívida' : 'Adicionar dívida'}</Adicionar>
          </Passo>
        )}

        {passo === 5 && (
          <Passo titulo="O que você tem hoje?" sub="Valores aproximados servem. Isso alimenta a reserva de emergência e o patrimônio líquido.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Saldo em conta corrente" type="number" sufixo="R$" value={bens.conta || ''} onChange={(e) => setBens({ ...bens, conta: num(e.target.value) })} />
              <Campo rotulo="Investimentos (total)" type="number" sufixo="R$" value={bens.investimentos || ''} onChange={(e) => setBens({ ...bens, investimentos: num(e.target.value) })} />
              <Campo rotulo={temImovel ? 'Valor de mercado do imóvel financiado' : 'Imóveis (valor de mercado)'} type="number" sufixo="R$" value={bens.imovel || ''} onChange={(e) => setBens({ ...bens, imovel: num(e.target.value) })} />
              <Campo rotulo="Veículos" type="number" sufixo="R$" value={bens.veiculo || ''} onChange={(e) => setBens({ ...bens, veiculo: num(e.target.value) })} />
            </div>
            <p className="mt-3 text-xs text-apagado">Depois, em Patrimônio, dá para separar cada investimento e definir o rendimento de cada um.</p>
          </Passo>
        )}

        {passo === 6 && (
          <Passo titulo="Tudo pronto" sub="Confira o resumo. Você muda qualquer coisa depois em Fluxo, Cartão, Imóvel, Dívidas e Patrimônio.">
            <dl className="grid grid-cols-2 gap-3">
              <Resumo rotulo="Renda/mês" valor={moeda(totalRenda)} tom="text-neon" />
              <Resumo rotulo="Contas fixas/mês" valor={moeda(totalContas)} />
              <Resumo rotulo="Parcelas de dívidas" valor={moeda(totalDividas)} />
              <Resumo rotulo="Sobra antes do cartão" valor={moeda(totalRenda - totalContas - totalDividas)} tom={totalRenda - totalContas - totalDividas >= 0 ? '' : 'text-rosa'} />
            </dl>
            <p className="mt-4 text-sm text-suave">
              {cartoes.length ? `${cartoes.length} cartão(ões)` : 'Nenhum cartão'} · {temImovel && imovel.valor > 0 ? 'financiamento cadastrado' : 'sem financiamento'} ·{' '}
              {dividas.filter((x) => x.saldo > 0).length} dívida(s)
            </p>
            <div className="mt-5 rounded-xl border border-neon/25 bg-neon/5 p-4 text-sm">
              <div className="font-medium">Próximo passo: importar as faturas</div>
              <div className="mt-1 text-suave">Baixe os PDFs das últimas 3 faturas de cada cartão e solte em Importar. As análises ficam boas a partir de 3 meses de dados.</div>
            </div>
          </Passo>
        )}
      </div>

      {passo > 0 && (
        <div className="mt-6 flex items-center justify-between gap-3">
          <Botao onClick={() => setPasso(passo - 1)}>Voltar</Botao>
          {passo < 6 ? (
            <div className="flex gap-2">
              <Botao className="!border-transparent !bg-transparent text-suave" onClick={() => setPasso(passo + 1)}>
                Pular
              </Botao>
              <Botao variante="primario" onClick={() => setPasso(passo + 1)}>
                Continuar
              </Botao>
            </div>
          ) : (
            <Botao variante="primario" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar e abrir o painel'}
            </Botao>
          )}
        </div>
      )}
    </div>
  )
}

function Passo({ titulo, sub, children }: { titulo: string; sub: string; children: ReactNode }) {
  return (
    <section className="vidro p-5 md:p-7">
      <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{titulo}</h1>
      <p className="mt-1 mb-6 text-sm text-suave">{sub}</p>
      {children}
    </section>
  )
}

function ListaValores({ linhas, setLinhas, placeholder, novo }: { linhas: Linha[]; setLinhas: (l: Linha[]) => void; placeholder: string; novo: string }) {
  return (
    <>
      <div className="space-y-2">
        {linhas.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_7.5rem_auto] items-end gap-2 sm:grid-cols-[1fr_9rem_auto]">
            <Campo rotulo={i === 0 ? 'Descrição' : ''} value={l.nome} placeholder={placeholder} onChange={(e) => setLinhas(linhas.map((x, k) => (k === i ? { ...x, nome: e.target.value } : x)))} />
            <Campo rotulo={i === 0 ? 'Valor/mês' : ''} type="number" sufixo="R$" value={l.valor || ''} onChange={(e) => setLinhas(linhas.map((x, k) => (k === i ? { ...x, valor: num(e.target.value) } : x)))} />
            <Remover onClick={() => setLinhas(linhas.filter((_, k) => k !== i))} />
          </div>
        ))}
      </div>
      <Adicionar onClick={() => setLinhas([...linhas, { nome: '', valor: 0 }])}>{novo}</Adicionar>
    </>
  )
}

const Remover = ({ onClick }: { onClick: () => void }) => (
  <button className="mb-2.5 cursor-pointer text-apagado hover:text-rosa" onClick={onClick} title="Remover">
    <IcLixo width={16} height={16} />
  </button>
)

const Adicionar = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button className="mt-3 flex cursor-pointer items-center gap-1.5 text-sm text-neon hover:underline" onClick={onClick}>
    <IcSoma width={14} height={14} />
    {children}
  </button>
)

const Total = ({ rotulo, valor }: { rotulo: string; valor: number }) => (
  <div className="mt-5 flex items-baseline justify-between border-t border-linha pt-4">
    <span className="rotulo">{rotulo}</span>
    <span className="num font-display text-2xl font-semibold">{moeda(valor)}</span>
  </div>
)

const Resumo = ({ rotulo, valor, tom = '' }: { rotulo: string; valor: string; tom?: string }) => (
  <div className="rounded-xl border border-linha p-3">
    <dt className="rotulo">{rotulo}</dt>
    <dd className={`num mt-1 font-display text-xl font-semibold ${tom}`}>{valor}</dd>
  </div>
)
