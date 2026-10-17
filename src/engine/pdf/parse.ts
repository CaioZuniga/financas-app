import { lerValorBR, MESES_CURTOS } from '../../lib/format'

export type Banco = 'Nubank' | 'C6' | 'Inter' | 'Itaú' | 'Bradesco' | 'XP' | 'Santander' | 'BB' | 'Outro'

export interface ItemExtraido {
  /** AAAA-MM-DD da compra. */
  data: string
  descricao: string
  /** Positivo = gasto; negativo = crédito, estorno ou pagamento. */
  valor: number
  parcela?: { atual: number; total: number }
}

export interface FaturaExtraida {
  banco: Banco
  /** AAAA-MM-DD, quando encontrado no texto. */
  vencimento?: string
  total?: number
  itens: ItemExtraido[]
  /** Linhas que pareciam lançamento mas não casaram com nenhum padrão (para calibrar). */
  ignoradas: string[]
}

const BANCOS: [RegExp, Banco][] = [
  [/nu pagamentos|nubank/i, 'Nubank'],
  [/banco c6|c6 bank|c6 carbon|c6 s\.a/i, 'C6'],
  [/banco inter|inter&co/i, 'Inter'],
  [/ita[uú] unibanco|itaucard/i, 'Itaú'],
  [/bradesco/i, 'Bradesco'],
  [/banco xp|xp investimentos|xp visa/i, 'XP'],
  [/santander/i, 'Santander'],
  [/banco do brasil|ourocard/i, 'BB'],
]

export function detectarBanco(texto: string): Banco {
  return BANCOS.find(([re]) => re.test(texto))?.[1] ?? 'Outro'
}

const mesPorNome = (s: string): number => {
  const i = MESES_CURTOS.indexOf(s.toLowerCase().slice(0, 3))
  return i >= 0 ? i + 1 : NaN
}
export const lerMes = (s: string) => (/^\d+$/.test(s) ? Number(s) : mesPorNome(s))
export const MES_TXT = '(?:\\d{2}|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)'
export const VALOR = '(?:[-−–]\\s?)?(?:R\\$\\s?)?(?:[-−–]\\s?)?\\d{1,3}(?:\\.\\d{3})*,\\d{2}'

export function acharVencimento(texto: string): string | undefined {
  const re = new RegExp(`vencimento[^\\d]{0,40}(\\d{2})[\\/ ]${MES_TXT.replace('(?:', '(')}[\\/ ](\\d{4})`, 'i')
  const m = texto.match(re)
  if (!m) return undefined
  const mes = lerMes(m[2])
  if (!mes) return undefined
  return `${m[3]}-${String(mes).padStart(2, '0')}-${m[1]}`
}

export function acharTotal(texto: string): number | undefined {
  // "Total da fatura" (C6, Inter), "Total a pagar" (Nubank), "fatura de outubro, no valor de" (capa do Nubank).
  const m =
    texto.match(new RegExp(`total (?:da|desta) fatura[^\\d]{0,30}(${VALOR})`, 'i')) ??
    texto.match(new RegExp(`total a pagar[^\\d]{0,30}(${VALOR})`, 'i')) ??
    texto.match(new RegExp(`no valor de[^\\d]{0,10}(${VALOR})`, 'i'))
  return m ? Math.abs(lerValorBR(m[1])) : undefined
}

const LINHA = new RegExp(
  `^(\\d{2})[\\/ ](${MES_TXT})(?:[\\/ ](\\d{2,4}))?\\s+(.+?)\\s+(${VALOR})\\s*$`,
  'i',
)

const NAO_E_LANCAMENTO = /^(total|subtotal|saldo|pagamento m[ií]nimo|limite|fatura anterior|encargos|juros do rotativo|valor (?:total|m[ií]nimo))/i

function extrairParcela(desc: string): { descricao: string; parcela?: ItemExtraido['parcela'] } {
  const m =
    desc.match(/\s*[-–]?\s*parc(?:ela)?\.?\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\s*/i) ??
    desc.match(/\s+(\d{1,2})\/(\d{1,2})\s*$/)
  if (!m) return { descricao: desc }
  const atual = Number(m[1])
  const total = Number(m[2])
  if (atual < 1 || total < 2 || atual > total) return { descricao: desc }
  return { descricao: desc.replace(m[0], ' ').trim(), parcela: { atual, total } }
}

function limparDescricao(desc: string): string {
  return desc
    .replace(/[•·●]{2,}\s*\d{4}/g, '') // "•••• 1234" (Nubank)
    .replace(/\b(?:US\$|USD)\s?[\d.,]+/g, '') // valor em dólar ao lado
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Lê as linhas de texto de uma fatura. Funciona para o layout "DD MMM descrição valor"
 * (Nubank, C6, Inter, XP) e "DD/MM descrição valor" (bancões).
 */
export function parseFatura(linhas: string[], hoje = new Date()): FaturaExtraida {
  const texto = linhas.join('\n')
  const banco = detectarBanco(texto)
  const vencimento = acharVencimento(texto)
  const ref = vencimento ? new Date(vencimento + 'T12:00:00') : hoje
  const anoRef = ref.getFullYear()
  const mesRef = ref.getMonth() + 1

  const itens: ItemExtraido[] = []
  const ignoradas: string[] = []

  for (const bruta of linhas) {
    const linha = bruta.replace(/\s+/g, ' ').trim()
    const m = linha.match(LINHA)
    if (!m) {
      if (/^\d{2}[/ ]/.test(linha) && /\d,\d{2}/.test(linha)) ignoradas.push(linha)
      continue
    }
    const [, dia, mesTxt, anoTxt, descBruta, valorTxt] = m
    const mes = lerMes(mesTxt)
    if (!mes || mes > 12 || Number(dia) > 31) continue
    const desc0 = limparDescricao(descBruta)
    if (!desc0 || NAO_E_LANCAMENTO.test(desc0)) continue

    let ano = anoTxt ? Number(anoTxt.length === 2 ? '20' + anoTxt : anoTxt) : anoRef
    if (!anoTxt && mes > mesRef) ano -= 1

    const { descricao, parcela } = extrairParcela(desc0)
    let valor = lerValorBR(valorTxt)
    // Alguns bancos mostram créditos sem sinal, só com a palavra.
    if (valor > 0 && /estorno|pagamento recebido|pagamento efetuado|cr[eé]dito de/i.test(descricao)) valor = -valor

    itens.push({
      data: `${ano}-${String(mes).padStart(2, '0')}-${dia}`,
      descricao,
      valor,
      parcela,
    })
  }

  return { banco, vencimento, total: acharTotal(texto), itens, ignoradas }
}
