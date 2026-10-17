import { Component, type ReactNode } from 'react'

/** Se uma tela quebrar, mostra o erro só nela e mantém o menu funcionando. */
export class ErroTela extends Component<{ children: ReactNode; chave: string }, { erro: Error | null; chave: string }> {
  state = { erro: null as Error | null, chave: this.props.chave }

  static getDerivedStateFromError(erro: Error) {
    return { erro }
  }

  static getDerivedStateFromProps(props: { chave: string }, state: { chave: string }) {
    // Trocar de tela limpa o erro.
    return props.chave !== state.chave ? { erro: null, chave: props.chave } : null
  }

  render() {
    if (!this.state.erro) return this.props.children
    return (
      <div className="vidro max-w-xl p-6">
        <div className="font-display text-lg font-semibold text-rosa">Esta tela teve um erro</div>
        <p className="mt-2 text-sm text-suave">Seus dados estão salvos. Recarregue a página; se continuar, faça um backup em Ajustes.</p>
        <pre className="mt-4 overflow-auto rounded-xl bg-black/30 p-3 font-mono text-[11px] text-apagado">{this.state.erro.message}</pre>
        <button className="mt-4 cursor-pointer rounded-xl border border-linha px-4 py-2 text-sm hover:border-linha-forte" onClick={() => location.reload()}>
          Recarregar
        </button>
      </div>
    )
  }
}
