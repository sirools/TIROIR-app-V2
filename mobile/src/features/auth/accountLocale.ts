// Langue du compte (user_metadata.locale), lue par les e-mails : celle de
// l'app. Même champ que le site (web/lib/accountLocale.ts).
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { preferredLanguage, type AppLanguage } from '@/i18n'

/** Compte sans langue (Apple, Google, comptes d'avant) : on lui donne celle de l'app. */
export async function rememberAccountLocale(user: User) {
  if (typeof user.user_metadata?.locale === 'string' && user.user_metadata.locale) return
  await supabase.auth.updateUser({ data: { locale: await preferredLanguage() } })
}

/** Langue choisie dans les réglages : elle devient celle du compte. */
export async function saveAccountLocale(locale: AppLanguage) {
  const { data } = await supabase.auth.getSession()
  if (!data.session) return
  await supabase.auth.updateUser({ data: { locale } })
}
