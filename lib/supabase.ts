
import { createClient } from '@supabase/supabase-js';

// These environment variables must be set in your .env file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
    // Warn only in development, or handle gracefully
    console.warn('Supabase URL or Key is missing. Storage features may not work.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function uploadWaybill(file: File, referenceId: string): Promise<string | null> {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `waybills/${referenceId}_${Date.now()}.${fileExt}`;

        const { data, error } = await supabase.storage
            .from('documents') // Ensure this bucket exists in Supabase
            .upload(fileName, file);

        if (error) {
            console.error('Supabase Upload Error:', error);
            throw error;
        }

        return data.path; // Return path for usage with Signed URLs
    } catch (error) {
        console.error('Upload Failed:', error);
        return null;
    }
}
