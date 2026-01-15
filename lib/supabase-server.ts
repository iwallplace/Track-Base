import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Use the Service Role Key for Admin privileges (Server-side ONLY)
// The user provided 'POSTGRES_SUPABASE_SERVICE_ROLE_KEY' in the prompt.
const supabaseServiceKey = process.env.POSTGRES_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('Supabase Server configuration missing. Signed URLs will fail.');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
