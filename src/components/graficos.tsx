import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { moeda } from '../lib/format'

const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
const rotuloEixo = (v: number) => (Math.abs(v) >= 1000 ? compacto.format(v) : String(Math.round(v)))

function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(600)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/** Escala com divisões "redondas" (1, 2, 2.5, 5 × 10^n). */
function escala(min: number, max: number, divisoes = 4) {
  if (max === min) max = min + 1
  const bruto = (max - min) / divisoes
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)))
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= bruto)!
  const lo = Math.floor(min / passo) * passo
  const hi = Math.ceil(max / passo) * passo
  const ticks: number[] = []
  for (let v = lo; v <= hi + passo / 2; v += passo) ticks.push(v)
  return { lo, hi, ticks }
}

export interface Serie {
  nome: string
  cor: string
  tracejado?: boolean
}

function Dica({ x, largura, titulo, linhas }: { x: number; largura: number; titulo: string; linhas: ReactNode[] }) {
  const esquerda = x > largura / 2
  return (
    <div
      className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-xl border border-linha-forte bg-painel-2/95 px-3 py-2 text-xs shadow-2xl backdrop-blur"
      style={esquerda ? { right: largura - x + 12 } : { left: x + 12 }}
    >
      <div className="rotulo mb-1 !text-suave">{titulo}</div>
      {linhas}
    </div>
  )
}

const LinhaDica = ({ cor, nome, valor }: { cor: string; nome: string; valor: number }) => (
  <div className="flex items-center justify-between gap-4 py-0.5">
    <span className="flex items-center gap-1.5 text-suave">
      <span className="size-2 rounded-full" style={{ background: cor }} />
      {nome}
    </span>
    <span className="num font-medium text-texto">{moeda(valor)}</span>
  </div>
)

const M = { t: 12, r: 8, b: 26, l: 56 }

/** Linhas (a primeira com área preenchida), crosshair e dica no hover. */
export function GraficoLinha({
  rotulos,
  series,
  valores,
  altura = 240,
  zeroNoEixo = true,
}: {
  rotulos: string[]
  series: Serie[]
  /** valores[serie][ponto] */
  valores: number[][]
  altura?: number
  zeroNoEixo?: boolean
}) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const id = useId().replace(/:/g, '')
  const todos = valores.flat()
  if (todos.length === 0) return null
  const { lo, hi, ticks } = escala(zeroNoEixo ? Math.min(0, ...todos) : Math.min(...todos), Math.max(...todos))
  const W = largura - M.l - M.r
  const H = altura - M.t - M.b
  const n = rotulos.length
  const px = (i: number) => M.l + (n === 1 ? W / 2 : (i / (n - 1)) * W)
  const py = (v: number) => M.t + H - ((v - lo) / (hi - lo)) * H
  const passoRotulo = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(W / 64))))

  const caminho = (vs: number[]) => vs.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join('')

  function mover(e: React.PointerEvent) {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect()
    const x = e.clientX - r.left - M.l
    setHover(Math.max(0, Math.min(n - 1, Math.round((x / W) * (n - 1)))))
  }

  return (
    <div ref={ref} className="relative w-full min-w-0 overflow-hidden select-none">
      <svg width={largura} height={altura} onPointerMove={mover} onPointerLeave={() => setHover(null)} className="block touch-none">
        <defs>
          <linearGradient id={`a${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={series[0].cor} stopOpacity="0.28" />
            <stop offset="1" stopColor={series[0].cor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={M.l + W} y1={py(t)} y2={py(t)} stroke="var(--color-linha)" strokeDasharray={t === 0 ? undefined : '2 4'} />
            <text x={M.l - 10} y={py(t)} dy="0.32em" textAnchor="end" className="fill-apagado font-mono text-[10px]">
              {rotuloEixo(t)}
            </text>
          </g>
        ))}
        {rotulos.map((r, i) =>
          i % passoRotulo === 0 ? (
            <text key={i} x={px(i)} y={altura - 6} textAnchor="middle" className="fill-apagado font-mono text-[10px]">
              {r}
            </text>
          ) : null,
        )}
        <path d={`${caminho(valores[0])}L${px(n - 1)},${py(Math.max(lo, 0))}L${px(0)},${py(Math.max(lo, 0))}Z`} fill={`url(#a${id})`} />
        {series.map((s, k) => (
          <path
            key={s.nome}
            d={caminho(valores[k])}
            fill="none"
            stroke={s.cor}
            strokeWidth={2}
            strokeDasharray={s.tracejado ? '5 4' : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {hover !== null && (
          <g>
            <line x1={px(hover)} x2={px(hover)} y1={M.t} y2={M.t + H} stroke="var(--color-linha-forte)" />
            {series.map((s, k) => (
              <circle key={s.nome} cx={px(hover)} cy={py(valores[k][hover])} r={4.5} fill={s.cor} stroke="var(--color-fundo)" strokeWidth={2} />
            ))}
          </g>
        )}
      </svg>
      {hover !== null && (
        <Dica
          x={px(hover)}
          largura={largura}
          titulo={rotulos[hover]}
          linhas={series.map((s, k) => <LinhaDica key={s.nome} cor={s.cor} nome={s.nome} valor={valores[k][hover]} />)}
        />
      )}
    </div>
  )
}

/** Barras agrupadas por mês, dica por coluna. */
export function GraficoBarras({
  rotulos,
  series,
  valores,
  altura = 240,
}: {
  rotulos: string[]
  series: Serie[]
  valores: number[][]
  altura?: number
}) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const todos = valores.flat()
  if (todos.length === 0) return null
  const { lo, hi, ticks } = escala(Math.min(0, ...todos), Math.max(...todos))
  const W = largura - M.l - M.r
  const H = altura - M.t - M.b
  const n = rotulos.length
  const banda = W / n
  const gap = 2
  const larguraBarra = Math.min(18, (banda * 0.62 - gap * (series.length - 1)) / series.length)
  const py = (v: number) => M.t + H - ((v - lo) / (hi - lo)) * H
  const passoRotulo = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(W / 44))))

  return (
    <div ref={ref} className="relative w-full min-w-0 overflow-hidden select-none">
      <svg width={largura} height={altura} className="block" onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={M.l + W} y1={py(t)} y2={py(t)} stroke="var(--color-linha)" strokeDasharray={t === 0 ? undefined : '2 4'} />
            <text x={M.l - 10} y={py(t)} dy="0.32em" textAnchor="end" className="fill-apagado font-mono text-[10px]">
              {rotuloEixo(t)}
            </text>
          </g>
        ))}
        {rotulos.map((r, i) => {
          const x0 = M.l + i * banda + (banda - (larguraBarra * series.length + gap * (series.length - 1))) / 2
          return (
            <g key={i} onPointerEnter={() => setHover(i)}>
              <rect x={M.l + i * banda} y={M.t} width={banda} height={H} fill={hover === i ? 'rgb(255 255 255 / 0.04)' : 'transparent'} rx={8} />
              {series.map((s, k) => {
                const v = valores[k][i]
                const y = py(Math.max(v, 0))
                const h = Math.abs(py(v) - py(0))
                return (
                  <path
                    key={s.nome}
                    d={barraArredondada(x0 + k * (larguraBarra + gap), y, larguraBarra, h, v >= 0)}
                    fill={s.cor}
                    opacity={hover === null || hover === i ? 1 : 0.45}
                  />
                )
              })}
              {i % passoRotulo === 0 && (
                <text x={M.l + i * banda + banda / 2} y={altura - 6} textAnchor="middle" className="fill-apagado font-mono text-[10px]">
                  {r}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {hover !== null && (
        <Dica
          x={M.l + hover * banda + banda / 2}
          largura={largura}
          titulo={rotulos[hover]}
          linhas={series.map((s, k) => <LinhaDica key={s.nome} cor={s.cor} nome={s.nome} valor={valores[k][hover]} />)}
        />
      )}
    </div>
  )
}

/** Retângulo com cantos de 4px só na ponta do dado (a base fica reta, presa no eixo). */
function barraArredondada(x: number, y: number, w: number, h: number, paraCima: boolean) {
  const r = Math.min(4, w / 2, h)
  if (h <= 0) return ''
  if (paraCima)
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
  return `M${x},${y}V${y + h - r}Q${x},${y + h} ${x + r},${y + h}H${x + w - r}Q${x + w},${y + h} ${x + w},${y + h - r}V${y}Z`
}

/** Lista de categorias com barra horizontal e rótulo direto. */
export function BarrasCategoria({ itens, onClick }: { itens: { rotulo: string; valor: number; cor: string }[]; onClick?: (r: string) => void }) {
  const max = Math.max(...itens.map((i) => i.valor), 1)
  const total = itens.reduce((s, i) => s + i.valor, 0)
  return (
    <ul className="space-y-3">
      {itens.map((i) => (
        <li key={i.rotulo} className={onClick ? 'cursor-pointer' : ''} onClick={() => onClick?.(i.rotulo)} title={moeda(i.valor)}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: i.cor }} />
              {i.rotulo}
            </span>
            <span className="num text-suave">
              {moeda(i.valor)} <span className="ml-1 font-mono text-[11px] text-apagado">{((i.valor / total) * 100).toFixed(0)}%</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.05]">
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${(i.valor / max) * 100}%`, background: i.cor }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Mini linha sem eixo para o herói. */
export function Faisca({ valores, cor = 'var(--color-neon)', altura = 56 }: { valores: number[]; cor?: string; altura?: number }) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const id = useId().replace(/:/g, '')
  if (valores.length < 2) return <div ref={ref} />
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const px = (i: number) => (i / (valores.length - 1)) * (largura - 8) + 4
  const py = (v: number) => altura - 6 - ((v - min) / (max - min || 1)) * (altura - 12)
  const d = valores.map((v, i) => `${i ? 'L' : 'M'}${px(i)},${py(v)}`).join('')
  return (
    <div ref={ref} className="w-full">
      <svg width={largura} height={altura} className="block overflow-visible">
        <defs>
          <linearGradient id={`f${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={cor} stopOpacity="0.35" />
            <stop offset="1" stopColor={cor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${d}L${px(valores.length - 1)},${altura}L${px(0)},${altura}Z`} fill={`url(#f${id})`} />
        <path d={d} fill="none" stroke={cor} strokeWidth={2} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${cor})` }} />
        <circle cx={px(valores.length - 1)} cy={py(valores.at(-1)!)} r={4} fill={cor} />
      </svg>
    </div>
  )
}

