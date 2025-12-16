import { createClient } from '@supabase/supabase-js'

/**
 * Supabase client for server-side operations
 * Uses service role key for admin access
 */
export const supabaseServer = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!,
    {
        auth: {
            persistSession: false
        }
    }
)
