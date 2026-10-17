/**
 * Sincronização com o Google Drive na pasta oculta do app (appDataFolder): só este app enxerga o
 * arquivo, e ele vai criptografado (src/engine/cripto.ts). Login pelo Google Identity Services,
 * direto do navegador, sem servidor.
 */
import type { Cofre } from '../engine/cripto'

const ESCOPO = 'https://www.googleapis.com/auth/drive.appdata'
const ARQUIVO = 'financas-backup.json'
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

interface TokenResposta {
  access_token?: string
  expires_in?: number
  error?: string
}
interface ClienteToken {
  requestAccessToken: (o?: { prompt?: string }) => void
  callback: (r: TokenResposta) => void
}
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (c: { client_id: string; scope: string; callback: (r: TokenResposta) => void; error_callback?: (e: { type: string }) => void }) => ClienteToken
          revoke: (token: string, done?: () => void) => void
        }
      }
    }
  }
}

let scriptCarregando: Promise<void> | null = null
function carregarGis(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve()
  scriptCarregando ??= new Promise((ok, falha) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => ok()
    s.onerror = () => falha(new Error('Não consegui carregar o login do Google. Verifique a internet.'))
    document.head.appendChild(s)
  })
  return scriptCarregando
}

let token: { valor: string; expira: number } | null = null

/** Pede (ou reaproveita) o token de acesso. `interativo` abre o popup do Google se precisar. */
export async function entrar(clientId: string, interativo = true): Promise<string> {
  if (token && token.expira > Date.now() + 60_000) return token.valor
  await carregarGis()
  return new Promise((ok, falha) => {
    const cliente = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: ESCOPO,
      callback: (r) => {
        if (!r.access_token) return falha(new Error(r.error === 'access_denied' ? 'Acesso ao Drive negado.' : `Login falhou: ${r.error}`))
        token = { valor: r.access_token, expira: Date.now() + (r.expires_in ?? 3600) * 1000 }
        ok(r.access_token)
      },
      error_callback: (e) => falha(new Error(e.type === 'popup_closed' ? 'Login cancelado.' : `Login falhou: ${e.type}`)),
    })
    cliente.requestAccessToken({ prompt: interativo ? '' : 'none' })
  })
}

export function sair() {
  if (token && window.google) window.google.accounts.oauth2.revoke(token.valor)
  token = null
}

export const conectado = () => !!token && token.expira > Date.now()

async function chamar(url: string, init: RequestInit = {}) {
  if (!token) throw new Error('Entre com o Google primeiro.')
  const r = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token.valor}` } })
  if (r.status === 401) {
    token = null
    throw new Error('A sessão do Google expirou. Entre de novo.')
  }
  if (!r.ok) throw new Error(`Drive respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return r
}

export interface InfoRemoto {
  id: string
  modificadoEm: number
}

export async function infoRemoto(): Promise<InfoRemoto | null> {
  const q = encodeURIComponent(`name='${ARQUIVO}'`)
  const r = await chamar(`${API}/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)&pageSize=1`)
  const f = (await r.json()).files?.[0]
  return f ? { id: f.id, modificadoEm: Date.parse(f.modifiedTime) } : null
}

export async function baixar(id: string): Promise<Cofre> {
  const r = await chamar(`${API}/files/${id}?alt=media`)
  return r.json()
}

export async function enviar(cofre: Cofre, id?: string): Promise<InfoRemoto> {
  const corpo = JSON.stringify(cofre)
  let r: Response
  if (id) {
    r = await chamar(`${UPLOAD}/files/${id}?uploadType=media&fields=id,modifiedTime`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: corpo,
    })
  } else {
    const limite = 'financas' + Math.random().toString(36).slice(2)
    const multipart =
      `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name: ARQUIVO, parents: ['appDataFolder'] }) +
      `\r\n--${limite}\r\nContent-Type: application/json\r\n\r\n${corpo}\r\n--${limite}--`
    r = await chamar(`${UPLOAD}/files?uploadType=multipart&fields=id,modifiedTime`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${limite}` },
      body: multipart,
    })
  }
  const f = await r.json()
  return { id: f.id, modificadoEm: Date.parse(f.modifiedTime) }
}
