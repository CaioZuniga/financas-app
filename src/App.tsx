import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import { IcAjustes, IcCadeado, IcCartao, IcCasa, IcDivida, IcFluxo, IcImportar, IcPainel } from './components/icones'
import Ajustes from './screens/Ajustes'
import Cartao from './screens/Cartao'
import Dividas from './screens/Dividas'
import Fluxo from './screens/Fluxo'
import Imovel from './screens/Imovel'
import Importar from './screens/Importar'
import Painel from './screens/Painel'

const NAV = [
  { to: '/', rotulo: 'Painel', Icone: IcPainel },
  { to: '/cartao', rotulo: 'Cartão', Icone: IcCartao },
  { to: '/importar', rotulo: 'Importar', Icone: IcImportar },
  { to: '/imovel', rotulo: 'Imóvel', Icone: IcCasa },
  { to: '/dividas', rotulo: 'Dívidas', Icone: IcDivida },
  { to: '/fluxo', rotulo: 'Fluxo', Icone: IcFluxo },
  { to: '/ajustes', rotulo: 'Ajustes', Icone: IcAjustes },
]

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

export default function App() {
  return (
    <HashRouter>
      <div className="fundo-app" />
      <div className="mx-auto flex min-h-dvh max-w-[1440px]">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-linha px-4 py-6 md:flex">
          <Marca />
          <nav className="mt-10 flex flex-col gap-1">
            {NAV.map(({ to, rotulo, Icone }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
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
          </nav>
          <div className="mt-auto flex items-start gap-2 rounded-xl border border-linha p-3 text-xs text-suave">
            <IcCadeado className="mt-0.5 shrink-0 text-neon" width={14} height={14} />
            Seus dados ficam só neste aparelho. Faça backup em Ajustes.
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex items-center justify-between px-4 pt-5 md:hidden">
            <Marca />
          </header>
          <main className="px-4 pt-6 pb-28 md:px-8 md:pt-10 md:pb-12">
            <Routes>
              <Route path="/" element={<Painel />} />
              <Route path="/cartao" element={<Cartao />} />
              <Route path="/importar" element={<Importar />} />
              <Route path="/imovel" element={<Imovel />} />
              <Route path="/dividas" element={<Dividas />} />
              <Route path="/fluxo" element={<Fluxo />} />
              <Route path="/ajustes" element={<Ajustes />} />
            </Routes>
          </main>
        </div>
      </div>

      <nav className="rolagem-fina fixed inset-x-3 bottom-3 z-20 flex justify-between gap-1 overflow-x-auto rounded-2xl border border-linha-forte bg-painel/90 p-1.5 backdrop-blur-xl md:hidden" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
        {NAV.map(({ to, rotulo, Icone }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] transition ${isActive ? 'bg-neon/10 text-neon' : 'text-apagado'}`
            }
          >
            <Icone />
            {rotulo}
          </NavLink>
        ))}
      </nav>
    </HashRouter>
  )
}
