import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const waybillNo = formData.get('waybillNo') as string;

        if (!file || !waybillNo) {
            return NextResponse.json(
                { error: 'Dosya veya İrsaliye No eksik' },
                { status: 400 }
            );
        }

        // Strict PDF validation (Server-side)
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            return NextResponse.json(
                { error: 'Sadece PDF dosyaları yüklenebilir' },
                { status: 400 }
            );
        }

        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json(
                { error: 'Dosya boyutu 10MB\'dan küçük olmalı' },
                { status: 400 }
            );
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `waybills/${waybillNo}_${Date.now()}.${fileExt}`;

        // Upload to Supabase
        const { data, error } = await supabase.storage
            .from('documents')
            .upload(fileName, file);

        if (error) {
            console.error('Supabase Server Upload Error:', error);
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ path: data.path });

    } catch (error: any) {
        console.error('Upload Route Error:', error);
        return NextResponse.json(
            { error: error.message || 'Sunucu hatası' },
            { status: 500 }
        );
    }
}
