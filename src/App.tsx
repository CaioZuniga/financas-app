import { useState } from 'react'
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import {
  IcAjustes,
  IcAnalise,
  IcCadeado,
  IcCartao,
  IcCasa,
  IcConta,
  IcDivida,
  IcFluxo,
  IcImportar,
  IcMais,
  IcMeta,
  IcPainel,
  IcPatrimonio,
  IcRelatorio,
} from './components/icones'
import { ErroTela } from './components/ErroTela'
import Ajustes from './screens/Ajustes'
import Analises from './screens/Analises'
import Cartao from './screens/Cartao'
import Comecar from './screens/Comecar'
import Conta from './screens/Conta'
import Dividas from './screens/Dividas'
import Fluxo from './screens/Fluxo'
import Imovel from './screens/Imovel'
import Importar from './screens/Importar'
import Metas from './screens/Metas'
import Painel from './screens/Painel'
import Patrimonio from './screens/Patrimonio'
import Relatorio from './screens/Relatorio'

const GRUPOS = [
  {
    titulo: 'Dia a dia',
    itens: [
      { to: '/', rotulo: 'Painel', Icone: IcPainel },
      { to: '/cartao', rotulo: 'Cartão', Icone: IcCartao },
      { to: '/conta', rotulo: 'Conta', Icone: IcConta },
      { to: '/metas', rotulo: 'Metas', Icone: IcMeta },
      { to: '/analises', rotulo: 'Análises', Icone: IcAnalise },
      { to: '/importar', rotulo: 'Importar', Icone: IcImportar },
    ],
  },
  {
    titulo: 'Longo prazo',
    itens: [
      { to: '/patrimonio', rotulo: 'Patrimônio', Icone: IcPatrimonio },
      { to: '/imovel', rotulo: 'Imóvel', Icone: IcCasa },
      { to: '/dividas', rotulo: 'Dívidas', Icone: IcDivida },
      { to: '/fluxo', rotulo: 'Fluxo', Icone: IcFluxo },
      { to: '/relatorio', rotulo: 'Relatório', Icone: IcRelatorio },
    ],
  },
  { titulo: '', itens: [{ to: '/ajustes', rotulo: 'Ajustes', Icone: IcAjustes }] },
]
const TODOS = GRUPOS.flatMap((g) => g.itens)
/** No celular a barra mostra estes; o resto fica em "Mais". */
const BARRA_MOBILE = ['/', '/cartao', '/metas', '/importar']

function Marca() {
  return (
    <div className="flex items-center gap-2.5">
      <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="size-8 rounded-[10px]" />
      <span className="font-display text-[1.05rem] font-semibold tracking-tight">
        finanças<span className="text-neon">.</span>
      </span>
    </div>
  )
}

function NavMobile() {
  const [aberto, setAberto] = useState(false)
  const { pathname } = useLocation()
  const noMais = !BARRA_MOBILE.includes(pathname)
  const classe = (ativo: boolean) =>
    `flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] transition ${ativo ? 'bg-neon/10 text-neon' : 'text-apagado'}`

  return (
    <>
      {aberto && (
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setAberto(false)}>
          <div
            className="entrar absolute inset-x-3 bottom-20 grid grid-cols-3 gap-2 rounded-2xl border border-linha-forte bg-painel p-3"
            style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          >
            {TODOS.filter((i) => !BARRA_MOBILE.includes(i.to)).map(({ to, rotulo, Icone }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setAberto(false)}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 rounded-xl border py-3 text-xs ${isActive ? 'border-neon/40 bg-neon/10 text-neon' : 'border-linha text-suave'}`
                }
              >
                <Icone />
                {rotulo}
              </NavLink>
            ))}
          </div>
        </div>
      )}
      <nav
        className="fixed inset-x-3 bottom-3 z-40 flex justify-between gap-1 rounded-2xl border border-linha-forte bg-painel/90 p-1.5 backdrop-blur-xl md:hidden"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TODOS.filter((i) => BARRA_MOBILE.includes(i.to)).map(({ to, rotulo, Icone }) => (
          <NavLink key={to} to={to} end={to === '/'} onClick={() => setAberto(false)} className={({ isActive }) => classe(isActive)}>
            <Icone />
            {rotulo}
          </NavLink>
        ))}
        <button className={classe(noMais || aberto)} onClick={() => setAberto(!aberto)}>
          <IcMais />
          Mais
        </button>
      </nav>
    </>
  )
}

export default function App() {
  return (
    <HashRouter>
      <div className="fundo-app" />
      <div className="mx-auto flex min-h-dvh max-w-[1440px]">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-linha px-4 py-6 md:flex">
          <Marca />
          <nav className="mt-8 flex flex-col gap-5">
            {GRUPOS.map((g) => (
              <div key={g.titulo} className="flex flex-col gap-1">
                {g.titulo && <div className="rotulo mb-1 px-3">{g.titulo}</div>}
                {g.itens.map(({ to, rotulo, Icone }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                        isActive ? 'bg-white/[0.06] text-texto' : 'text-suave hover:bg-white/[0.03] hover:text-texto'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="absolute top-2 bottom-2 -left-4 w-[3px] rounded-r-full bg-neon shadow-[0_0_12px_var(--color-neon)]" />}
                        <Icone className={isActive ? 'text-neon' : ''} />
                        {rotulo}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <div className="mt-auto flex items-start gap-2 rounded-xl border border-linha p-3 text-xs text-suave">
            <IcCadeado className="mt-0.5 shrink-0 text-neon" width={14} height={14} />
            Seus dados ficam só neste aparelho. Faça backup em Ajustes.
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="no-print flex items-center justify-between px-4 pt-5 md:hidden">
            <Marca />
          </header>
          <main className="px-4 pt-6 pb-28 md:px-8 md:pt-10 md:pb-12">
            <Telas />
          </main>
        </div>
      </div>
      <NavMobile />
    </HashRouter>
  )
}

function Telas() {
  const { pathname } = useLocation()
  return (
    <ErroTela chave={pathname}>
            <Routes>
              <Route path="/" element={<Painel />} />
              <Route path="/comecar" element={<Comecar />} />
              <Route path="/cartao" element={<Cartao />} />
              <Route path="/conta" element={<Conta />} />
              <Route path="/metas" element={<Metas />} />
              <Route path="/analises" element={<Analises />} />
              <Route path="/importar" element={<Importar />} />
              <Route path="/patrimonio" element={<Patrimonio />} />
              <Route path="/imovel" element={<Imovel />} />
              <Route path="/dividas" element={<Dividas />} />
              <Route path="/fluxo" element={<Fluxo />} />
              <Route path="/relatorio" element={<Relatorio />} />
              <Route path="/ajustes" element={<Ajustes />} />
            </Routes>
    </ErroTela>
  )
}
