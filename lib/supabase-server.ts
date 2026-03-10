import { createClient } from '@supabase/supabase-js'

/**
 * Supabase client for server-side operations
 * Uses service role key for admin access
 */
export const supabaseServer = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE || 'placeholder_key',
    {
        auth: {
            persistSession: false
        }
    }
)
