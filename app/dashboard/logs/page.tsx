'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import AuditLogViewer from '@/components/audit-log-viewer';
import { useLanguage } from '@/components/language-provider';

export default function LogsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { t } = useLanguage();

    // Security: Only ADMIN can view logs
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/dashboard');
        } else if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
            router.push('/dashboard');
        }
    }, [status, session, router]);

    if (status === 'loading' || !session || session.user.role !== 'ADMIN') {
        return null; // Or a loading spinner / access denied message
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-foreground">Sistem Kayıtları</h2>
                <p className="text-muted-foreground">Sistemdeki tüm işlem geçmişi (Audit Logs).</p>
            </div>

            <div className="rounded-xl border border-border bg-card">
                <AuditLogViewer />
            </div>
        </div>
    );
}
