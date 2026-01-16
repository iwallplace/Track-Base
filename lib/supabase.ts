
import { createClient } from '@supabase/supabase-js';

// These environment variables must be set in your .env file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function uploadWaybill(file: File, referenceId: string): Promise<{ path: string | null; error: string | null }> {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `waybills/${referenceId}_${Date.now()}.${fileExt}`;

        const { data, error } = await supabase.storage
            .from('documents') // Ensure this bucket exists in Supabase
            .upload(fileName, file);

        if (error) {
            console.error('Supabase Upload Error:', error);
            return { path: null, error: error.message };
        }

        return { path: data.path, error: null }; // Return path for usage with Signed URLs
    } catch (error: any) {
        console.error('Upload Failed:', error);
        return { path: null, error: error.message || 'Bilinmeyen bir hata oluştu' };
    }
}
