import type { SVGProps } from 'react'

const base = (d: string) =>
  function Icone(p: SVGProps<SVGSVGElement>) {
    return (
      <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...p}>
        <path d={d} />
      </svg>
    )
  }

export const IcPainel = base('M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z')
export const IcCartao = base('M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M7 15h3')
export const IcConta = base('M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18')
export const IcImportar = base('M12 3v12m0 0-4-4m4 4 4-4M5 21h14')
export const IcMeta = base('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01')
export const IcPatrimonio = base('M12 3 3 8l9 5 9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5')
export const IcCasa = base('M3 11 12 4l9 7M5 10v10h14V10M10 20v-6h4v6')
export const IcDivida = base('M4 19h16M6 15l4-4 3 3 5-6M18 8h-3m3 0v3')
export const IcFluxo = base('M3 17l5-5 4 4 8-8M14 8h6v6')
export const IcAjustes = base('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .3-1.5-1.5L17 5l-3-1-1 2h-2L10 4 7 5l.5 2.8L6 9.3 4 9l-1 3 2 1v1l-2 1 1 3 2-.3 1.5 1.5L7 21l3 1 1-2h2l1 2 3-1-.5-2.8 1.5-1.5 2 .3 1-3-2-1z')
export const IcMais = base('M5 12h.01M12 12h.01M19 12h.01')
export const IcLixo = base('M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13')
export const IcCadeado = base('M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3')
export const IcRelatorio = base('M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6M10 9h2')
export const IcAnalise = base('M4 20V10M10 20V4M16 20v-7M22 20H2M16 9l3-3 3 3')
export const IcSoma = base('M12 5v14M5 12h14')
export const IcAlerta = base('M12 4 2.5 20h19zM12 10v4M12 17h.01')
