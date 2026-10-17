export type AcaoSync = 'enviar' | 'baixar' | 'conflito' | 'em-dia'

/**
 * O que fazer ao sincronizar, comparando com a última sincronização deste aparelho:
 * só um lado mudou → leva para o outro; os dois mudaram → conflito (o usuário escolhe).
 */
export function decidirSync(opts: { remotoEm: number | null; localAlteradoEm: number; ultimaSync: number }): AcaoSync {
  // Margem para diferença de relógio entre o aparelho e o Google.
  const MARGEM = 5_000
  if (opts.remotoEm === null) return 'enviar'
  const remotoMudou = opts.remotoEm > opts.ultimaSync + MARGEM
  const localMudou = opts.localAlteradoEm > opts.ultimaSync
  if (opts.ultimaSync === 0) return localMudou ? 'conflito' : 'baixar'
  if (remotoMudou && localMudou) return 'conflito'
  if (remotoMudou) return 'baixar'
  if (localMudou) return 'enviar'
  return 'em-dia'
}
