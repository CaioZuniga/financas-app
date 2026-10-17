import { useState } from 'react'
import { alteradoEm, gravarTudo, lerTudo, type Dados } from '../db'
import { destrancar, trancar } from '../engine/cripto'
import { decidirSync } from '../engine/sync'
import * as drive from '../lib/drive'
import { Botao, CabecalhoCard, Card } from './ui'

// Preferências deste aparelho (não vão no backup).
const LS = { clientId: 'financas:googleClientId', senha: 'financas:senhaBackup', ultima: 'financas:ultimaSync', remotoId: 'financas:driveId' }
const ler = (k: string) => {
  try {
    return localStorage.getItem(k) ?? ''
  } catch {
    return ''
  }
}
const gravar = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch {
    /* sem localStorage: vale só para esta sessão */
  }
}
const CLIENT_ID_PADRAO = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? ''
const quando = (t: number) => (t ? new Date(t).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca')

export default function SyncDrive() {
  const [clientId, setClientId] = useState(ler(LS.clientId) || CLIENT_ID_PADRAO)
  const [senha, setSenha] = useState(ler(LS.senha))
  const [lembrar, setLembrar] = useState(!!ler(LS.senha))
  const [conectado, setConectado] = useState(drive.conectado())
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)
  const [remotoEm, setRemotoEm] = useState<number | null>(null)
  const ultima = Number(ler(LS.ultima) || 0)

  async function rodar(fn: () => Promise<string>) {
    setOcupado(true)
    setMsg(null)
    try {
      setMsg({ tom: 'ok', texto: await fn() })
    } catch (e) {
      setMsg({ tom: 'erro', texto: (e as Error).message })
    } finally {
      setOcupado(false)
      setConectado(drive.conectado())
    }
  }

  function exigirSenha() {
    if (senha.length < 8) throw new Error('Use uma senha de backup com pelo menos 8 caracteres.')
    gravar(LS.senha, lembrar ? senha : null)
  }

  const conectar = () =>
    rodar(async () => {
      gravar(LS.clientId, clientId.trim())
      await drive.entrar(clientId.trim())
      const r = await drive.infoRemoto()
      setRemotoEm(r?.modificadoEm ?? null)
      return r ? `Conectado. Há um backup no Drive de ${quando(r.modificadoEm)}.` : 'Conectado. Ainda não há backup no Drive.'
    })

  async function enviarAgora(id?: string) {
    const cofre = await trancar(await lerTudo(), senha)
    const r = await drive.enviar(cofre, id)
    gravar(LS.remotoId, r.id)
    gravar(LS.ultima, String(Math.max(Date.now(), r.modificadoEm)))
    setRemotoEm(r.modificadoEm)
    return 'Enviado para o Drive.'
  }

  async function baixarAgora(id: string) {
    const dados = await destrancar<Dados>(await drive.baixar(id), senha)
    await gravarTudo(dados)
    const r = await drive.infoRemoto()
    gravar(LS.ultima, String(Math.max(Date.now(), r?.modificadoEm ?? 0)))
    return 'Dados do Drive trazidos para este aparelho.'
  }

  const sincronizar = () =>
    rodar(async () => {
      exigirSenha()
      await drive.entrar(clientId.trim())
      const r = await drive.infoRemoto()
      setRemotoEm(r?.modificadoEm ?? null)
      const acao = decidirSync({ remotoEm: r?.modificadoEm ?? null, localAlteradoEm: alteradoEm(), ultimaSync: ultima })
      if (acao === 'em-dia') return 'Tudo em dia: nada mudou desde a última sincronização.'
      if (acao === 'enviar') return enviarAgora(r?.id)
      if (acao === 'baixar') return baixarAgora(r!.id)
      // Conflito: os dois lados mudaram.
      if (window.confirm(`Os dados mudaram aqui e no Drive (${quando(r!.modificadoEm)}).\n\nOK = usar a versão do Drive (substitui este aparelho)\nCancelar = escolher outra opção`))
        return baixarAgora(r!.id)
      if (window.confirm('Enviar a versão deste aparelho e substituir a do Drive?')) return enviarAgora(r!.id)
      return 'Nada foi alterado.'
    })

  const forcar = (lado: 'enviar' | 'baixar') =>
    rodar(async () => {
      exigirSenha()
      await drive.entrar(clientId.trim())
      const r = await drive.infoRemoto()
      if (lado === 'enviar') {
        if (r && !window.confirm('Substituir o backup do Drive pelos dados deste aparelho?')) return 'Nada foi alterado.'
        return enviarAgora(r?.id)
      }
      if (!r) throw new Error('Não há backup no Drive ainda.')
      if (!window.confirm('Substituir TODOS os dados deste aparelho pela versão do Drive?')) return 'Nada foi alterado.'
      return baixarAgora(r.id)
    })

  return (
    <Card atraso={2} destaque className="lg:col-span-2">
      <CabecalhoCard
        titulo="Sincronizar com o Google Drive"
        sub="Backup criptografado com a sua senha numa pasta oculta do Drive que só este app enxerga. Use a mesma senha no PC e no celular."
      />

      {!ler(LS.clientId) && !CLIENT_ID_PADRAO && <ConfigurarCliente clientId={clientId} setClientId={setClientId} />}

      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="rotulo mb-1.5 block">Senha do backup</span>
            <input className="campo" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="mínimo 8 caracteres" />
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm text-suave">
            <input type="checkbox" className="accent-[var(--color-neon)]" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} />
            Lembrar neste aparelho
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {!conectado ? (
            <Botao onClick={conectar} disabled={ocupado || !clientId.trim()}>
              Entrar com Google
            </Botao>
          ) : (
            <Botao
              onClick={() => {
                drive.sair()
                setConectado(false)
                setMsg({ tom: 'ok', texto: 'Desconectado do Google.' })
              }}
            >
              Sair
            </Botao>
          )}
          <Botao variante="primario" onClick={sincronizar} disabled={ocupado || !clientId.trim() || senha.length < 8}>
            {ocupado ? 'Sincronizando…' : 'Sincronizar agora'}
          </Botao>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
        <div>
          <dt className="rotulo">Última sincronização</dt>
          <dd className="mt-0.5 text-suave">{quando(ultima)}</dd>
        </div>
        <div>
          <dt className="rotulo">Alterado aqui</dt>
          <dd className="mt-0.5 text-suave">{quando(alteradoEm())}</dd>
        </div>
        <div>
          <dt className="rotulo">Backup no Drive</dt>
          <dd className="mt-0.5 text-suave">{remotoEm ? quando(remotoEm) : conectado ? 'nenhum' : 'entre para ver'}</dd>
        </div>
      </dl>

      {msg && <p className={`mt-3 text-sm ${msg.tom === 'ok' ? 'text-neon' : 'text-rosa'}`}>{msg.texto}</p>}

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-suave">Opções avançadas</summary>
        <div className="mt-3 flex flex-wrap gap-2">
          <Botao onClick={() => forcar('enviar')} disabled={ocupado || senha.length < 8}>
            Enviar e substituir o Drive
          </Botao>
          <Botao variante="perigo" onClick={() => forcar('baixar')} disabled={ocupado || senha.length < 8}>
            Baixar e substituir este aparelho
          </Botao>
        </div>
        <label className="mt-3 block max-w-md">
          <span className="rotulo mb-1.5 block">Google Client ID</span>
          <input className="campo font-mono text-xs" value={clientId} onChange={(e) => setClientId(e.target.value)} onBlur={() => gravar(LS.clientId, clientId.trim())} />
        </label>
        <p className="mt-2 text-xs text-apagado">Esqueceu a senha do backup? Não dá para recuperar: crie outro backup com uma nova senha usando “Enviar e substituir o Drive”.</p>
      </details>
    </Card>
  )
}

function ConfigurarCliente({ clientId, setClientId }: { clientId: string; setClientId: (v: string) => void }) {
  return (
    <div className="mb-5 rounded-xl border border-ambar/30 bg-ambar/5 p-4 text-sm">
      <div className="font-medium">Configuração única: Client ID do Google</div>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-suave">
        <li>
          Em console.cloud.google.com, crie um projeto e ative a <b className="text-texto">Google Drive API</b>.
        </li>
        <li>Em “Tela de consentimento OAuth”, escolha Externo e adicione o seu e-mail como usuário de teste.</li>
        <li>
          Em “Credenciais” → Criar → ID do cliente OAuth → <b className="text-texto">Aplicativo da Web</b>, com origens{' '}
          <code className="font-mono text-xs text-texto">https://caiozuniga.github.io</code> e{' '}
          <code className="font-mono text-xs text-texto">http://localhost:5174</code>.
        </li>
        <li>Cole o ID do cliente abaixo (termina em .apps.googleusercontent.com).</li>
      </ol>
      <input className="campo mt-3 font-mono text-xs" placeholder="000000000000-xxxx.apps.googleusercontent.com" value={clientId} onChange={(e) => setClientId(e.target.value)} />
    </div>
  )
}
