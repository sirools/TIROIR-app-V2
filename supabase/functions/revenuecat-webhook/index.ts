import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleRevenueCatWebhook } from './handler.ts'

// Point d'entrée : la logique est dans handler.ts (testée côté site).
const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve((req) => handleRevenueCatWebhook(req, {
  secrets: [Deno.env.get('REVENUECAT_WEBHOOK_SECRET'), Deno.env.get('REVENUECAT_WEBHOOK_SECRET_NEXT')],
  db: () => createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY),
}))
