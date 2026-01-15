import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { supabaseAdmin } from "@/lib/supabase-server";
import { unauthorizedResponse, errorResponse, successResponse } from "@/lib/api-response";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return unauthorizedResponse();

    try {
        const { path } = await req.json();

        if (!path) return errorResponse("Dosya yolu gereklidir", 400);

        // Generate Signed URL (valid for 1 hour)
        const { data, error } = await supabaseAdmin
            .storage
            .from('documents')
            .createSignedUrl(path, 60 * 60); // 1 hour

        if (error) {
            console.error("Sign Error:", error);
            return errorResponse("Link oluşturulamadı");
        }

        return successResponse({ signedUrl: data.signedUrl });
    } catch (error) {
        console.error("Storage Sign API Error:", error);
        return errorResponse("Sunucu hatası");
    }
}
