import { getDocument, GlobalWorkerOptions, PasswordResponses } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

interface ItemTexto {
  str: string
  transform: number[]
  width: number
}

/**
 * Extrai o PDF como linhas de texto, juntando os pedaços que estão na mesma altura da página.
 * Tudo roda no navegador; o arquivo não sai do aparelho.
 */
export async function extrairLinhas(arquivo: File, pedirSenha: () => Promise<string | null>): Promise<string[]> {
  const dados = new Uint8Array(await arquivo.arrayBuffer())
  const tarefa = getDocument({ data: dados })
  tarefa.onPassword = async (responder: (s: string) => void, motivo: number) => {
    const senha = await pedirSenha()
    if (senha === null) {
      tarefa.destroy()
      return
    }
    if (motivo === PasswordResponses.INCORRECT_PASSWORD || motivo === PasswordResponses.NEED_PASSWORD) responder(senha)
  }
  const pdf = await tarefa.promise
  const linhas: string[] = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const pagina = await pdf.getPage(p)
    const conteudo = await pagina.getTextContent()
    const itens = (conteudo.items as ItemTexto[]).filter((i) => 'str' in i && i.str.trim() !== '')
    // Agrupa por linha com tolerância de 2,5 pt.
    const grupos: { y: number; itens: ItemTexto[] }[] = []
    for (const it of itens) {
      const y = it.transform[5]
      const g = grupos.find((g) => Math.abs(g.y - y) < 2.5)
      if (g) g.itens.push(it)
      else grupos.push({ y, itens: [it] })
    }
    grupos.sort((a, b) => b.y - a.y)
    for (const g of grupos) {
      g.itens.sort((a, b) => a.transform[4] - b.transform[4])
      linhas.push(g.itens.map((i) => i.str.trim()).join(' '))
    }
  }
  await pdf.destroy()
  return linhas
}
