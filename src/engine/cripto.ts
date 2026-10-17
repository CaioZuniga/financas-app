/**
 * Criptografia do backup que vai para a nuvem: AES-GCM 256 com chave derivada da senha
 * (PBKDF2-SHA256). Sem a senha, o arquivo no Drive é ilegível, inclusive para o Google.
 */

const ITERACOES = 310_000

export interface Cofre {
  app: 'financas-app'
  formato: 1
  em: string
  iteracoes: number
  sal: string
  iv: string
  dados: string
}

const b64 = (bytes: Uint8Array) => {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function derivarChave(senha: string, sal: Uint8Array, iteracoes: number) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal as BufferSource, iterations: iteracoes },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function trancar(conteudo: unknown, senha: string): Promise<Cofre> {
  const sal = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const chave = await derivarChave(senha, sal, ITERACOES)
  const claro = new TextEncoder().encode(JSON.stringify(conteudo))
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, claro))
  return { app: 'financas-app', formato: 1, em: new Date().toISOString(), iteracoes: ITERACOES, sal: b64(sal), iv: b64(iv), dados: b64(cifrado) }
}

export class SenhaErrada extends Error {
  constructor() {
    super('Senha do backup incorreta.')
  }
}

export async function destrancar<T = unknown>(cofre: Cofre, senha: string): Promise<T> {
  if (cofre.app !== 'financas-app' || cofre.formato !== 1) throw new Error('Arquivo não é um backup do Finanças.')
  const chave = await derivarChave(senha, deB64(cofre.sal), cofre.iteracoes)
  try {
    const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(cofre.iv) as BufferSource }, chave, deB64(cofre.dados) as BufferSource)
    return JSON.parse(new TextDecoder().decode(claro)) as T
  } catch {
    throw new SenhaErrada()
  }
}
