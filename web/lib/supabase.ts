import { createClient } from '@supabase/supabase-js'
import { createPagesBrowserClient, createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import type { GetServerSidePropsContext } from 'next'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const svcRole = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client navigateur cookie-aware : nécessaire pour que la session soit
// lisible côté serveur (getServerSideProps) via serverSupabase().
export const supabase = createPagesBrowserClient({
  supabaseUrl: url,
  supabaseKey: anon,
})

export function serverSupabase(ctx: GetServerSidePropsContext) {
  return createServerSupabaseClient(ctx)
}

export function adminSupabase() {
  return createClient(url, svcRole)
}
