export const CATEGORIAS = [
  'Mercado',
  'Restaurantes',
  'Delivery',
  'Transporte',
  'Combustível',
  'Assinaturas',
  'Saúde',
  'Compras',
  'Casa',
  'Educação',
  'Viagem',
  'Lazer',
  'Serviços',
  'Impostos',
  'Pagamentos',
  'Transferências',
  'Investimentos',
  'Receitas',
  'Outros',
] as const

/** Categorias que movem dinheiro mas não são consumo: ficam fora de orçamento e gastos. */
export const NAO_CONSUMO: Categoria[] = ['Pagamentos', 'Investimentos', 'Receitas']

export type Categoria = (typeof CATEGORIAS)[number]

export interface Regra {
  id?: number
  /** Trecho da descrição, em minúsculas e sem acento. */
  padrao: string
  categoria: Categoria
}

const PADRAO: [RegExp, Categoria][] = [
  [/pagamento|pgto|credito de|estorno/, 'Pagamentos'],
  [/ifood|ifd\*|rappi|ze delivery|aiqfome|james/, 'Delivery'],
  [/uber|99 ?app|99pop|99 tecnologia|cabify|metro|bilhete|sptrans|estacion|sem parar|veloe|conectcar|nutag|pedagio|\bpark\b|zona azul/, 'Transporte'],
  [/posto|shell|ipiranga|petrobras|br mania|combust/, 'Combustível'],
  [/netflix|spotify|disney|hbo|max\.com|prime video|amazon prime|youtube|apple\.com|google|icloud|deezer|globoplay|chatgpt|openai|claude|anthropic/, 'Assinaturas'],
  [/drogasil|droga raia|raia|pague menos|farmac|drogaria|hospital|clinica|laborat|unimed|amil|sulamerica|odonto/, 'Saúde'],
  [/carrefour|pao de acucar|extra |assai|atacad|supermerc|mercado(?! ?livre| ?pago)|hortifruti|sams club|\bdia |\boba |oxxo|emporio|comercio de alim|acougue|sacolao/, 'Mercado'],
  [/restaurante|bar |burger|lanch|pizza|padaria|cafe|starbucks|outback|mcdonald|mc donald|bk |habib|sushi|churrasc|sanduich|bistro|choper|sorvet|arabe|esfih|cantina|boteco|grill|doceria|confeitaria/, 'Restaurantes'],
  [/amazon|mercado ?livre|mercadolivre|shopee|aliexpress|magalu|magazine|americanas|shein|renner|zara|c&a|riachuelo|netshoes|centauro|kabum/, 'Compras'],
  [/leroy|telhanorte|tok&stok|tok stok|camicado|condominio|enel|sabesp|comgas|vivo|claro|tim |net |internet/, 'Casa'],
  [/escola|faculdade|curso|udemy|alura|livraria|saraiva/, 'Educação'],
  [/latam|gol |azul |airbnb|booking|hotel|decolar|hoteis|smiles|passagem/, 'Viagem'],
  [/barbearia|salao|cabeleire|lavanderia|estetica|manicure|correios|cartorio/, 'Serviços'],
  [/cinema|ingresso|sympla|eventim|steam|playstation|xbox|nintendo|cinemark/, 'Lazer'],
]

export const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** Regras do usuário (aprendidas ao recategorizar) vencem as regras padrão. */
export function categorizar(descricao: string, regras: Regra[] = []): Categoria {
  const d = normalizar(descricao) + ' '
  const doUsuario = regras.find((r) => d.includes(r.padrao))
  if (doUsuario) return doUsuario.categoria
  for (const [re, cat] of PADRAO) if (re.test(d)) return cat
  return 'Outros'
}

const FATURA_CARTAO = /pagamento (de |da )?fatura|pgto fatura|fatura (do )?cart|nu pagamentos|pagamento cartao|pag(amento)? cartao de credito/
const INVESTIMENTO = /aplicacao|resgate|\bcdb\b|\blci\b|\blca\b|tesouro|corretora|investiment|poupanca|rdb/
const IMPOSTO = /\bdarf\b|\bdas\b|iptu|ipva|imposto|receita federal|\binss\b|\bgps\b/
const TRANSFERENCIA = /\bpix\b|\bted\b|\bdoc\b|transferencia|transf\b/

/**
 * Categoria de um movimento da conta corrente. Pagamento da fatura do cartão vira "Pagamentos"
 * (os gastos já contam pela fatura) e entradas sem categoria clara viram "Receitas".
 */
export function categorizarMovimento(descricao: string, valor: number, regras: Regra[] = []): Categoria {
  const d = normalizar(descricao) + ' '
  const doUsuario = regras.find((r) => d.includes(r.padrao))
  if (doUsuario) return doUsuario.categoria
  if (FATURA_CARTAO.test(d)) return 'Pagamentos'
  if (INVESTIMENTO.test(d)) return 'Investimentos'
  if (IMPOSTO.test(d)) return 'Impostos'
  if (valor > 0) return /estorno|reembolso/.test(d) ? 'Outros' : 'Receitas'
  const c = categorizar(descricao)
  if (c !== 'Outros' && c !== 'Pagamentos') return c
  return TRANSFERENCIA.test(d) ? 'Transferências' : c === 'Pagamentos' ? 'Outros' : c
}

/** Chave estável de uma descrição para virar regra: tira parcela, números e asteriscos. */
export function chaveDescricao(descricao: string): string {
  return normalizar(descricao)
    .replace(/parc(ela)?\.? ?\d+ ?(\/|de) ?\d+/g, '')
    .replace(/\d{1,2}\/\d{1,2}/g, '')
    .replace(/[*#]/g, ' ')
    .replace(/\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
