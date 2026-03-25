// apps/listener/src/config/supabase.ts

import { createClient } from '@supabase/supabase-js'
import { env } from './env.js'

// Service role key bypasses RLS — only used server-side in the listener
export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
