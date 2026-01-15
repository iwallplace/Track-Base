'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/components/language-provider';
import {
    History, RefreshCw, User, Filter, Search, ChevronDown, ChevronRight,
    Download, Calendar, Activity, Trash2, Edit, Plus, RotateCcw, LogIn,
    AlertTriangle, Shield, Database, Copy, Check
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
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

type FilterState = {
    action: string;
    entity: string;
    user: string;
    dateRange: 'all' | '1d' | '7d' | '30d';
    search: string;
};

export default function AuditLogViewer() {
    const { t, language } = useLanguage();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [filters, setFilters] = useState<FilterState>({
        action: 'all',
        entity: 'all',
        user: 'all',
        dateRange: 'all',
        search: ''
    });
    const [showFilters, setShowFilters] = useState(false);
    const [page, setPage] = useState(1);
    const pageSize = 25;

    const fetchLogs = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/audit-logs?limit=500');
            if (res.ok) {
                const data = await res.json();
                setLogs(data);
            } else {
                setError('Loglar yüklenemedi');
            }
        } catch (err) {
            setError('Sunucu bağlantısı hatası');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    // Filter logs
    useEffect(() => {
        let result = [...logs];

        // Action filter
        if (filters.action !== 'all') {
            result = result.filter(log => log.action.includes(filters.action));
        }

        // Entity filter
        if (filters.entity !== 'all') {
            result = result.filter(log => log.entity === filters.entity);
        }

        // User filter
        if (filters.user !== 'all') {
            result = result.filter(log => log.user.username === filters.user);
        }

        // Date range filter
        if (filters.dateRange !== 'all') {
            const days = parseInt(filters.dateRange);
            const cutoff = subDays(new Date(), days);
            result = result.filter(log => new Date(log.createdAt) >= cutoff);
        }

        // Search filter
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            result = result.filter(log =>
                log.action.toLowerCase().includes(searchLower) ||
                log.entity.toLowerCase().includes(searchLower) ||
                log.entityId?.toLowerCase().includes(searchLower) ||
                log.details?.toLowerCase().includes(searchLower) ||
                log.user.name?.toLowerCase().includes(searchLower) ||
                log.user.username.toLowerCase().includes(searchLower)
            );
        }

        setFilteredLogs(result);
        setPage(1);
    }, [logs, filters]);

    // Get unique values for filter dropdowns
    const uniqueActions = [...new Set(logs.map(l => {
        if (l.action.includes('DELETE')) return 'DELETE';
        if (l.action.includes('UPDATE')) return 'UPDATE';
        if (l.action.includes('CREATE')) return 'CREATE';
        if (l.action.includes('RESTORE')) return 'RESTORE';
        if (l.action.includes('LOGIN')) return 'LOGIN';
        return l.action;
    }))];
    const uniqueEntities = [...new Set(logs.map(l => l.entity))];
    const uniqueUsers = [...new Set(logs.map(l => l.user.username))];

    const formatDate = (dateString: string) => {
        try {
            return format(new Date(dateString), 'dd MMM yyyy HH:mm:ss', {
                locale: language === 'tr' ? tr : enUS
            });
        } catch {
            return dateString;
        }
    };

    const getActionIcon = (action: string) => {
        if (action.includes('DELETE')) return <Trash2 className="h-4 w-4" />;
        if (action.includes('UPDATE')) return <Edit className="h-4 w-4" />;
        if (action.includes('CREATE')) return <Plus className="h-4 w-4" />;
        if (action.includes('RESTORE')) return <RotateCcw className="h-4 w-4" />;
        if (action.includes('LOGIN')) return <LogIn className="h-4 w-4" />;
        if (action.includes('BULK')) return <Database className="h-4 w-4" />;
        return <Activity className="h-4 w-4" />;
    };

    const getActionColor = (action: string) => {
        if (action.includes('DELETE') || action.includes('BULK_DELETE')) return 'text-red-500 bg-red-500/10 border-red-500/30';
        if (action.includes('UPDATE')) return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
        if (action.includes('CREATE')) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
        if (action.includes('RESTORE')) return 'text-purple-500 bg-purple-500/10 border-purple-500/30';
        if (action.includes('LOGIN')) return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
        return 'text-gray-500 bg-gray-500/10 border-gray-500/30';
    };

    const getEntityIcon = (entity: string) => {
        if (entity === 'INVENTORY') return <Database className="h-3 w-3" />;
        if (entity === 'USER') return <User className="h-3 w-3" />;
        if (entity === 'PERMISSION') return <Shield className="h-3 w-3" />;
        return <Activity className="h-3 w-3" />;
    };

    const toggleRow = (id: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedRows(newExpanded);
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const formatDetails = (details: string | null) => {
        if (!details) return null;
        try {
            return JSON.parse(details);
        } catch {
            return details;
        }
    };

    const exportLogs = () => {
        const csvContent = [
            ['Tarih', 'Kullanıcı', 'İşlem', 'Varlık', 'Varlık ID', 'Detaylar'].join(','),
            ...filteredLogs.map(log => [
                formatDate(log.createdAt),
                log.user.name || log.user.username,
                log.action,
                log.entity,
                log.entityId || '-',
                log.details?.replace(/,/g, ';') || '-'
            ].join(','))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `sistem_kayitlari_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
        link.click();
    };

    // Pagination
    const totalPages = Math.ceil(filteredLogs.length / pageSize);
    const paginatedLogs = filteredLogs.slice((page - 1) * pageSize, page * pageSize);

    // Stats
    const stats = {
        total: filteredLogs.length,
        creates: filteredLogs.filter(l => l.action.includes('CREATE')).length,
        updates: filteredLogs.filter(l => l.action.includes('UPDATE')).length,
        deletes: filteredLogs.filter(l => l.action.includes('DELETE')).length,
    };

    return (
        <div className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                            <Activity className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                            <p className="text-xs text-muted-foreground">Toplam Kayıt</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                            <Plus className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.creates}</p>
                            <p className="text-xs text-muted-foreground">Oluşturma</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/10">
                            <Edit className="h-5 w-5 text-amber-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.updates}</p>
                            <p className="text-xs text-muted-foreground">Güncelleme</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-red-500/10">
                            <Trash2 className="h-5 w-5 text-red-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.deletes}</p>
                            <p className="text-xs text-muted-foreground">Silme</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Card */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-border">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-indigo-500/10">
                                <History className="h-5 w-5 text-indigo-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-foreground">Sistem Kayıtları</h3>
                                <p className="text-xs text-muted-foreground">Tüm sistem aktiviteleri ve değişiklik geçmişi</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${showFilters ? 'bg-blue-500/10 border-blue-500/30 text-blue-600' : 'border-border hover:bg-muted'
                                    }`}
                            >
                                <Filter className="h-4 w-4" />
                                Filtreler
                            </button>
                            <button
                                onClick={exportLogs}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-muted text-sm transition-colors"
                            >
                                <Download className="h-4 w-4" />
                                <span className="hidden sm:inline">Dışa Aktar</span>
                            </button>
                            <button
                                onClick={fetchLogs}
                                disabled={loading}
                                className="p-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
                            >
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                {showFilters && (
                    <div className="p-4 border-b border-border bg-muted/30">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Ara..."
                                    value={filters.search}
                                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                    className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                />
                            </div>
                            <select
                                value={filters.action}
                                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                                className="px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            >
                                <option value="all">Tüm İşlemler</option>
                                {uniqueActions.map(a => (
                                    <option key={a} value={a}>{a}</option>
                                ))}
                            </select>
                            <select
                                value={filters.entity}
                                onChange={(e) => setFilters({ ...filters, entity: e.target.value })}
                                className="px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            >
                                <option value="all">Tüm Varlıklar</option>
                                {uniqueEntities.map(e => (
                                    <option key={e} value={e}>{e}</option>
                                ))}
                            </select>
                            <select
                                value={filters.user}
                                onChange={(e) => setFilters({ ...filters, user: e.target.value })}
                                className="px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            >
                                <option value="all">Tüm Kullanıcılar</option>
                                {uniqueUsers.map(u => (
                                    <option key={u} value={u}>{u}</option>
                                ))}
                            </select>
                            <select
                                value={filters.dateRange}
                                onChange={(e) => setFilters({ ...filters, dateRange: e.target.value as any })}
                                className="px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            >
                                <option value="all">Tüm Zamanlar</option>
                                <option value="1d">Son 24 Saat</option>
                                <option value="7d">Son 7 Gün</option>
                                <option value="30d">Son 30 Gün</option>
                            </select>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                            <tr>
                                <th className="px-4 py-3 w-8"></th>
                                <th className="px-4 py-3">Zaman</th>
                                <th className="px-4 py-3">Kullanıcı</th>
                                <th className="px-4 py-3">İşlem</th>
                                <th className="px-4 py-3">Varlık</th>
                                <th className="px-4 py-3">ID</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && logs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                                        Yükleniyor...
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-red-500">
                                        <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
                                        {error}
                                    </td>
                                </tr>
                            ) : paginatedLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                        <History className="h-6 w-6 mx-auto mb-2 opacity-50" />
                                        Kayıt bulunamadı
                                    </td>
                                </tr>
                            ) : (
                                paginatedLogs.map((log) => (
                                    <>
                                        <tr
                                            key={log.id}
                                            className={`border-b border-border hover:bg-muted/30 transition-colors cursor-pointer ${expandedRows.has(log.id) ? 'bg-muted/20' : ''}`}
                                            onClick={() => toggleRow(log.id)}
                                        >
                                            <td className="px-4 py-3">
                                                {expandedRows.has(log.id) ? (
                                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                                    <span className="font-mono text-xs text-muted-foreground">
                                                        {formatDate(log.createdAt)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {log.user.image ? (
                                                        <img src={log.user.image} alt="" className="w-6 h-6 rounded-full" />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                                                            <span className="text-xs font-medium text-primary">
                                                                {(log.user.name || log.user.username)[0].toUpperCase()}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <span className="font-medium text-foreground">
                                                        {log.user.name || log.user.username}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getActionColor(log.action)}`}>
                                                    {getActionIcon(log.action)}
                                                    {log.action}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                                    {getEntityIcon(log.entity)}
                                                    <span className="text-xs">{log.entity}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {log.entityId && (
                                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                                                        {log.entityId.length > 12 ? `${log.entityId.slice(0, 12)}...` : log.entityId}
                                                    </code>
                                                )}
                                            </td>
                                        </tr>
                                        {/* Expanded Details Row */}
                                        {expandedRows.has(log.id) && log.details && (
                                            <tr className="bg-muted/10 border-b border-border">
                                                <td colSpan={6} className="px-6 py-4">
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                                                                <Database className="h-4 w-4 text-muted-foreground" />
                                                                Detay Bilgisi
                                                            </h4>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    copyToClipboard(JSON.stringify(formatDetails(log.details), null, 2), log.id);
                                                                }}
                                                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                                            >
                                                                {copiedId === log.id ? (
                                                                    <>
                                                                        <Check className="h-3 w-3 text-emerald-500" />
                                                                        Kopyalandı
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Copy className="h-3 w-3" />
                                                                        Kopyala
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>
                                                        <pre className="text-xs bg-background border border-border rounded-lg p-4 overflow-x-auto font-mono text-foreground">
                                                            {JSON.stringify(formatDetails(log.details), null, 2)}
                                                        </pre>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-border flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            Toplam {filteredLogs.length} kayıttan {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredLogs.length)} arası gösteriliyor
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Önceki
                            </button>
                            <span className="text-sm text-muted-foreground px-2">
                                {page} / {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Sonraki
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
