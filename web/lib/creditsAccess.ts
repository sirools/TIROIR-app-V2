// Qui peut acheter des packs de crédits sur le site : Free et Premium.
// Le Pro (IA incluse, sans recharge) ne voit pas l'achat et le serveur le
// refuse. Un Pro sur facture échu compte comme gratuit (effective_plan).
// Module pur, testable.
type ProfileLike = { plan?: string | null; pro_expires_at?: string | null } | null | undefined

export function effectivePlan(p: ProfileLike, today = new Date().toISOString().slice(0, 10)): string {
  const plan = p?.plan ?? 'free'
  if (plan === 'pro' && p?.pro_expires_at && p.pro_expires_at < today) return 'free'
  return plan
}

export function creditsAllowedFor(p: ProfileLike, today?: string): boolean {
  return effectivePlan(p, today) !== 'pro'
}
