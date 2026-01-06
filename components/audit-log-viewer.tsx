'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/components/language-provider';
import { History, RefreshCw, User, ShieldAlert, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { tr, enUS } from 'date-fns/locale';

interface AuditLog {
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    details: string | null;
    createdAt: string;
    user: {
        name: string | null;
        username: string;
        image: string | null;
    };
}

export default function AuditLogViewer() {
    const { t, language } = useLanguage();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchLogs = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/audit-logs');
            if (res.ok) {
                const data = await res.json();
                setLogs(data);
            } else {
                setError('Failed to fetch logs');
            }
        } catch (err) {
            setError('Error connecting to server');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const formatDate = (dateString: string) => {
        try {
            return format(new Date(dateString), 'dd MMM yyyy HH:mm', {
                locale: language === 'tr' ? tr : enUS
            });
        } catch {
            return dateString;
        }
    };

    const getActionColor = (action: string) => {
        if (action.includes('DELETE')) return 'text-red-500 bg-red-500/10 border-red-500/20';
        if (action.includes('UPDATE')) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
        if (action.includes('CREATE')) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
        if (action.includes('RESTORE')) return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
        return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    };

    const formatDetails = (details: string | null) => {
        if (!details) return '-';
        try {
            const parsed = JSON.parse(details);
            return (
                <code className="text-[10px] bg-muted p-1 rounded block overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px]">
                    {JSON.stringify(parsed)}
                </code>
            );
        } catch {
            return <span className="text-xs text-muted-foreground">{details}</span>;
        }
    };

    return (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-indigo-500" />
                    <h3 className="text-lg font-medium text-foreground">{t('audit_logs')}</h3>
                </div>
                <button
                    onClick={fetchLogs}
                    disabled={loading}
                    className="p-2 hover:bg-secondary rounded-full transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`h-4 w-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
                        <tr>
                            <th className="px-6 py-3">{t('table_date')}</th>
                            <th className="px-6 py-3">{t('table_user')}</th>
                            <th className="px-6 py-3">{t('table_action')}</th>
                            <th className="px-6 py-3">{t('details')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && logs.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                                    {t('loading')}
                                </td>
                            </tr>
                        ) : error ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-red-500">
                                    {error}
                                </td>
                            </tr>
                        ) : logs.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                                    {t('no_results')}
                                </td>
                            </tr>
                        ) : (
                            logs.map((log) => (
                                <tr key={log.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-muted-foreground">
                                        {formatDate(log.createdAt)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {log.user.image ? (
                                                <img src={log.user.image} alt="" className="w-5 h-5 rounded-full" />
                                            ) : (
                                                <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center">
                                                    <User className="h-3 w-3 text-muted-foreground" />
                                                </div>
                                            )}
                                            <span className="font-medium text-foreground">{log.user.name || log.user.username}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${getActionColor(log.action)}`}>
                                                {log.action}
                                            </span>
                                            <span className="text-muted-foreground text-xs">{log.entity}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 w-1/3">
                                        {formatDetails(log.details)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="p-4 border-t border-border bg-muted/20 text-xs text-center text-muted-foreground">
                {t('showing_last_100')}
            </div>
        </div>
    );
}
