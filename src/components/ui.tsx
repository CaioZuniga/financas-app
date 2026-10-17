import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

export function Card({
  children,
  className = '',
  destaque = false,
  atraso = 0,
}: {
  children: ReactNode
  className?: string
  destaque?: boolean
  atraso?: number
}) {
  return (
    <section
      className={`${destaque ? 'vidro-destaque' : 'vidro'} entrar min-w-0 p-5 ${className}`}
      style={{ animationDelay: `${atraso * 60}ms` }}
    >
      {children}
    </section>
  )
}

export function CabecalhoCard({ titulo, sub, acao }: { titulo: string; sub?: string; acao?: ReactNode }) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="font-display text-[0.95rem] font-semibold tracking-tight">{titulo}</h2>
        {sub && <p className="mt-0.5 text-xs text-suave">{sub}</p>}
      </div>
      {acao}
    </header>
  )
}

export function Titulo({ titulo, sub, acao }: { titulo: string; sub?: string; acao?: ReactNode }) {
  return (
    <div className="entrar mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{titulo}</h1>
        {sub && <p className="mt-1 text-sm text-suave">{sub}</p>}
      </div>
      {acao}
    </div>
  )
}

export function Kpi({
  rotulo,
  valor,
  detalhe,
  tom = 'neutro',
  atraso = 0,
}: {
  rotulo: string
  valor: string
  detalhe?: ReactNode
  tom?: 'neutro' | 'neon' | 'violeta' | 'ambar' | 'rosa'
  atraso?: number
}) {
  const ponto = { neutro: 'bg-suave', neon: 'bg-neon', violeta: 'bg-violeta', ambar: 'bg-ambar', rosa: 'bg-rosa' }[tom]
  return (
    <Card atraso={atraso} className="!p-4">
      <div className="flex items-center gap-2">
        <span className={`size-1.5 rounded-full ${ponto} shadow-[0_0_10px_currentColor]`} />
        <span className="rotulo truncate">{rotulo}</span>
      </div>
      <div className="num mt-3 font-display text-xl font-semibold tracking-tight md:text-2xl">{valor}</div>
      {detalhe && <div className="mt-1 text-xs text-suave">{detalhe}</div>}
    </Card>
  )
}

type Variante = 'primario' | 'fantasma' | 'perigo'
export function Botao({
  variante = 'fantasma',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  const v = {
    primario:
      'bg-neon text-fundo font-semibold hover:brightness-110 shadow-[0_0_24px_-6px_var(--color-neon)] disabled:opacity-40 disabled:shadow-none',
    fantasma: 'border border-linha bg-white/[0.03] text-texto hover:border-linha-forte hover:bg-white/[0.06]',
    perigo: 'border border-rosa/30 bg-rosa/10 text-rosa hover:bg-rosa/20',
  }[variante]
  return (
    <button
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm transition disabled:cursor-not-allowed ${v} ${className}`}
      {...props}
    />
  )
}

export function Campo({
  rotulo,
  sufixo,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { rotulo: string; sufixo?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="rotulo mb-1.5 block">{rotulo}</span>
      <div className="relative">
        <input className={`campo num ${sufixo ? 'pr-16' : ''}`} {...props} />
        {sufixo && (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-mono text-xs text-apagado">
            {sufixo}
          </span>
        )}
      </div>
    </label>
  )
}

export function Selecao({
  rotulo,
  children,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { rotulo?: string }) {
  const sel = (
    <select className="campo cursor-pointer" {...props}>
      {children}
    </select>
  )
  if (!rotulo) return <div className={className}>{sel}</div>
  return (
    <label className={`block ${className}`}>
      <span className="rotulo mb-1.5 block">{rotulo}</span>
      {sel}
    </label>
  )
}

export function Chip({ ativo, children, onClick }: { ativo?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 cursor-pointer rounded-full border px-3 py-1 font-mono text-xs transition ${
        ativo
          ? 'border-neon/50 bg-neon/10 text-neon'
          : 'border-linha text-suave hover:border-linha-forte hover:text-texto'
      }`}
    >
      {children}
    </button>
  )
}

export function Progresso({ valor, cor = 'neon' }: { valor: number; cor?: 'neon' | 'violeta' | 'ambar' | 'rosa' }) {
  const c = { neon: 'from-neon/70 to-neon', violeta: 'from-violeta/60 to-violeta', ambar: 'from-ambar/60 to-ambar', rosa: 'from-rosa/60 to-rosa' }[cor]
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${c} transition-[width] duration-700`}
        style={{ width: `${Math.max(0, Math.min(1, valor)) * 100}%` }}
      />
    </div>
  )
}

export function Vazio({ titulo, texto, acao }: { titulo: string; texto: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-linha-forte px-6 py-10 text-center">
      <div className="font-display text-base font-semibold">{titulo}</div>
      <p className="mt-1 max-w-sm text-sm text-suave">{texto}</p>
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  )
}

export function Legenda({ itens }: { itens: { cor: string; rotulo: string; tracejado?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {itens.map((i) => (
        <span key={i.rotulo} className="flex items-center gap-1.5 text-xs text-suave">
          <span
            className="h-2 w-3 rounded-sm"
            style={
              i.tracejado
                ? { backgroundImage: `repeating-linear-gradient(90deg, ${i.cor} 0 3px, transparent 3px 5px)` }
                : { background: i.cor }
            }
          />
          {i.rotulo}
        </span>
      ))}
    </div>
  )
}
