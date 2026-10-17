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
  'Pagamentos',
  'Outros',
] as const

export type Categoria = (typeof CATEGORIAS)[number]

export interface Regra {
  id?: number
  /** Trecho da descrição, em minúsculas e sem acento. */
  padrao: string
  categoria: Categoria
}

const PADRAO: [RegExp, Categoria][] = [
  [/pagamento|pgto|credito de|estorno/, 'Pagamentos'],
  [/ifood|rappi|ze delivery|aiqfome|james/, 'Delivery'],
  [/uber|99 ?app|99pop|99 tecnologia|cabify|metro|bilhete|sptrans|estacion|sem parar|veloe|conectcar|pedagio/, 'Transporte'],
  [/posto|shell|ipiranga|petrobras|br mania|combust|ale /, 'Combustível'],
  [/netflix|spotify|disney|hbo|max\.com|prime video|amazon prime|youtube|apple\.com|google one|icloud|deezer|globoplay|chatgpt|openai|claude|anthropic/, 'Assinaturas'],
  [/drogasil|droga raia|raia|pague menos|farmac|drogaria|hospital|clinica|laborat|unimed|amil|sulamerica|odonto/, 'Saúde'],
  [/carrefour|pao de acucar|extra |assai|atacad|supermerc|mercado(?! ?livre| ?pago)|hortifruti|sams club|dia |oba /, 'Mercado'],
  [/restaurante|bar |burger|lanch|pizza|padaria|cafe|starbucks|outback|mcdonald|mc donald|bk |habib|sushi|churrasc/, 'Restaurantes'],
  [/amazon|mercado ?livre|mercadolivre|shopee|aliexpress|magalu|magazine|americanas|shein|renner|zara|c&a|riachuelo|netshoes|centauro|kabum/, 'Compras'],
  [/leroy|telhanorte|tok&stok|tok stok|camicado|condominio|enel|sabesp|comgas|vivo|claro|tim |net |internet/, 'Casa'],
  [/escola|faculdade|curso|udemy|alura|livraria|saraiva/, 'Educação'],
  [/latam|gol |azul |airbnb|booking|hotel|decolar|hoteis|smiles|passagem/, 'Viagem'],
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
