import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { IcLixo } from '../components/icones'
import SyncDrive from '../components/SyncDrive'
import { Botao, CabecalhoCard, Card, Titulo } from '../components/ui'
import { db, exportarBackup, restaurarBackup } from '../db'
import { carregarDemo } from '../lib/demo'

export default function Ajustes() {
  const regras = useLiveQuery(() => db.regras.toArray(), []) ?? []
  const [msg, setMsg] = useState<string | null>(null)

  async function baixar() {
    const blob = await exportarBackup()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `financas-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function restaurar(arq: File) {
    if (!window.confirm('Restaurar substitui todos os dados atuais pelos do backup. Continuar?')) return
    try {
      await restaurarBackup(arq)
      setMsg('Backup restaurado.')
    } catch (e) {
      setMsg((e as Error).message)
    }
  }

  async function apagarTudo() {
    if (!window.confirm('Apagar TODOS os dados deste aparelho? Faça um backup antes.')) return
    await db.delete()
    location.reload()
  }

  return (
    <div className="space-y-5">
      <Titulo titulo="Ajustes" sub="Backup, regras de categoria e dados" />

      <div className="grid gap-5 lg:grid-cols-2">
        <SyncDrive />
        <Card atraso={1}>
          <CabecalhoCard titulo="Backup em arquivo" sub="Os dados ficam só neste navegador. Um arquivo .json (sem criptografia) para guardar onde quiser." />
          <div className="flex flex-wrap gap-3">
            <Botao variante="primario" onClick={baixar}>
              Baixar backup (.json)
            </Botao>
            <label>
              <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && restaurar(e.target.files[0])} />
              <span className="inline-flex cursor-pointer items-center rounded-xl border border-linha bg-white/[0.03] px-4 py-2 text-sm hover:border-linha-forte">Restaurar backup</span>
            </label>
          </div>
          {msg && <p className="mt-3 text-sm text-neon">{msg}</p>}
        </Card>

        <Card atraso={2}>
          <CabecalhoCard titulo="Dados" />
          <div className="flex flex-wrap gap-3">
            <Botao onClick={() => carregarDemo().then(() => setMsg('Dados de exemplo carregados.'))}>Carregar dados de exemplo</Botao>
            <Botao variante="perigo" onClick={apagarTudo}>
              Apagar tudo
            </Botao>
          </div>
        </Card>
      </div>

      <Card atraso={3}>
        <CabecalhoCard titulo="Regras de categoria" sub="Criadas quando você muda a categoria de um lançamento" />
        {regras.length ? (
          <ul className="divide-y divide-linha">
            {regras.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <span className="font-mono text-suave">"{r.padrao}"</span> → {r.categoria}
                </span>
                <button className="cursor-pointer text-apagado hover:text-rosa" onClick={() => db.regras.delete(r.id!)}>
                  <IcLixo width={16} height={16} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-suave">Nenhuma regra ainda.</p>
        )}
      </Card>
    </div>
  )
}
