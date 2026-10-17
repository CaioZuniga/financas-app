import { lerValorBR } from '../../lib/format'
import { detectarBanco, lerMes, MES_TXT, VALOR, type Banco } from './parse'

export interface MovimentoExtraido {
  /** AAAA-MM-DD. */
  data: string
  descricao: string
  /** Positivo = entrada; negativo = saída. */
  valor: number
}

export interface ExtratoExtraido {
  banco: Banco
  itens: MovimentoExtraido[]
  ignoradas: string[]
}

/** Extrato tem saldo e entradas/saídas; fatura tem vencimento e limite. */
export function pareceExtrato(texto: string): boolean {
  const extrato = /extrato|total de entradas|total de sa[ií]das|saldo (inicial|final|anterior|do dia|em conta|dispon[ií]vel)/i.test(texto)
  const fatura = /data de vencimento|vencimento da fatura|total da fatura|total a pagar|limite (total|dispon[ií]vel)/i.test(texto)
  return extrato && !fatura
}

const DATA = new RegExp(`^(\\d{2})[/ ](${MES_TXT.slice(3, -1)})(?:[/ ](\\d{2,4}))?(?=\\s|$)\\s*(.*)$`, 'i')
const VALOR_MARCADO = new RegExp(`([+\\-−–]\\s?)?(${VALOR})(\\s?[DC])?(?=\\s|$)`, 'g')
const PULAR = /^(saldo|total|s a l d o|lan[cç]amentos|data\s|hist[oó]rico|descri[cç][aã]o|valor|p[aá]gina|\d+ de \d+$)/i
const SAIDA = /enviad|pagamento|compra|d[eé]bito|saque|tarifa|boleto|aplica[cç][aã]o|pix (?:para|out)|transfer[eê]ncia (?:para|enviada)|\bdarf\b/i
const ENTRADA = /recebid|sal[aá]rio|cr[eé]dito|dep[oó]sito|estorno|resgate|rendimento|reembolso|pix (?:de|in)\b/i

/**
 * Lê extratos de conta corrente. Aceita os dois formatos comuns:
 * data em cada linha ("05/10/2026 PIX ENVIADO FULANO -150,00 1.234,56") e data como
 * cabeçalho de um bloco de movimentos (Nubank: "05 OUT 2026 Total de saídas - 150,00").
 */
export function parseExtrato(linhas: string[], hoje = new Date()): ExtratoExtraido {
  const texto = linhas.join('\n')
  const anos = [...texto.matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]))
  const anoPadrao = anos.length ? Math.max(...anos) : hoje.getFullYear()

  const itens: MovimentoExtraido[] = []
  const ignoradas: string[] = []
  let dataAtual: string | null = null
  let sinalBloco = 0

  for (const bruta of linhas) {
    let linha = bruta.replace(/\s+/g, ' ').trim()
    const d = linha.match(DATA)
    if (d) {
      const mes = lerMes(d[2])
      if (mes && mes <= 12 && Number(d[1]) <= 31) {
        const ano = d[3] ? Number(d[3].length === 2 ? '20' + d[3] : d[3]) : anoPadrao
        dataAtual = `${ano}-${String(mes).padStart(2, '0')}-${d[1]}`
        sinalBloco = 0
        linha = d[4].trim()
      }
    }
    if (/total de entradas/i.test(linha)) {
      sinalBloco = 1
      continue
    }
    if (/total de sa[ií]das/i.test(linha)) {
      sinalBloco = -1
      continue
    }
    if (!linha || PULAR.test(linha)) continue

    const valores = [...linha.matchAll(VALOR_MARCADO)]
    if (!valores.length) continue
    if (!dataAtual) {
      ignoradas.push(bruta)
      continue
    }
    // Com duas colunas de valor, a última é o saldo do dia.
    const mov = valores.length >= 2 ? valores[valores.length - 2] : valores[0]
    const descricao = linha
      .slice(0, valores[0].index)
      .replace(/\s[-–]\s*$/, '')
      .trim()
    if (!descricao) {
      ignoradas.push(bruta)
      continue
    }
    const abs = Math.abs(lerValorBR(mov[2]))
    const prefixo = (mov[1] ?? '').trim()
    const marca = (mov[3] ?? '').trim().toUpperCase()
    let sinal: number
    if (prefixo && prefixo !== '+') sinal = -1
    else if (/-|−|–/.test(mov[2])) sinal = -1
    else if (prefixo === '+' || marca === 'C') sinal = 1
    else if (marca === 'D') sinal = -1
    else if (sinalBloco) sinal = sinalBloco
    else if (ENTRADA.test(descricao)) sinal = 1
    else if (SAIDA.test(descricao)) sinal = -1
    else sinal = -1

    itens.push({ data: dataAtual, descricao, valor: sinal * abs })
  }

  return { banco: detectarBanco(texto), itens, ignoradas }
}
