'use client';

import { useState, useEffect, use } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Calendar, FileText, Trash2, Search } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/components/language-provider';
import DeleteConfirmModal from '@/components/delete-confirm-modal';

interface InventoryItem {
    id: string;
    year: number;
    month: number;
    week: number;
    date: string;
    company: string;
    waybillNo: string;
    materialReference: string;
    stockCount: number;
    lastAction: string;
    note: string;
    modifierName?: string;
}

export default function MaterialHistoryPage({ params }: { params: Promise<{ materialRef: string }> }) {
    const { materialRef: rawRef } = use(params);
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, itemId: null as string | null });

    const { data: session } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const highlightId = searchParams.get('highlight');
    const { t } = useLanguage();
    // Decode URL encoded material reference
    const materialRef = decodeURIComponent(rawRef);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            // Fetch ALL items for this reference by using search & limit=-1
            const res = await fetch(`/api/inventory?limit=-1&search=${encodeURIComponent(materialRef)}`);
            if (res.ok) {
                const response = await res.json();
                const data = response.data || response;
                // Safely handle structure
                const allItems = data.items || (Array.isArray(data) ? data : []);

                // Strict filtering to ensure we only get this material's history
                // (Search might return partial matches)
                const history = allItems.filter((item: InventoryItem) => item.materialReference === materialRef);
                setItems(history);
            }
        } catch (error) {
            console.error("Failed to fetch history", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [materialRef]);

    // Scroll to highlight
    useEffect(() => {
        if (highlightId && items.length > 0 && !loading) {
            // Tiny timeout to ensure DOM is ready
            setTimeout(() => {
                const el = document.getElementById(`row-${highlightId}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        }
    }, [items, highlightId, loading]);

    const handleDeleteClick = (id: string) => {
        setDeleteModal({ isOpen: true, itemId: id });
    };

    const handleConfirmDelete = async () => {
        if (!deleteModal.itemId) return;

        try {
            const res = await fetch(`/api/inventory?id=${deleteModal.itemId}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                // Remove item from local state immediately for better UX
                setItems(prev => prev.filter(item => item.id !== deleteModal.itemId));
                setDeleteModal({ isOpen: false, itemId: null });
            } else {
                const txt = await res.text();
                // We can't really alert here if checking for XSS/nice UI, but standard alert for error is passable or use toast if available
                // For now, fail silently or log to console as requested "no alert" usually implies success alerts.
                // But error alerts are vital. I'll keep it simple: console log.
                console.error(`Delete failed: ${txt}`);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Paketlendi': return 'text-emerald-500';
            case 'Beklemede': return 'text-amber-500';
            case 'Sevk Edildi': return 'text-blue-500';
            case 'İade': return 'text-red-500';
            // Default mappings for Entry/Exit if those are standard status now
            case 'Giriş': return 'text-emerald-600';
            case 'Çıkış': return 'text-red-600';
            default: return 'text-gray-500';
        }
    };

    // Helper for translated status
    const getStatusLabel = (status: string) => {
        if (status === 'Giriş') return t('status_entry');
        if (status === 'Çıkış') return t('status_exit');
        return status;
    };

    const filteredItems = items.filter(item => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            item.company?.toLowerCase().includes(q) ||
            item.waybillNo?.toLowerCase().includes(q) ||
            item.note?.toLowerCase().includes(q) ||
            item.modifierName?.toLowerCase().includes(q)
        );
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard/inventory"
                        className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                        title={t('back')}
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h2 className="text-2xl font-bold text-foreground">{t('material_history')}</h2>
                        <p className="text-muted-foreground font-mono">{materialRef}</p>
                    </div>
                </div>

                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder={t('search_placeholder') || 'Ara...'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow"
                    />
                </div>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                <div className="p-6 border-b border-border flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">{t('movement_records')}</h3>
                    <div className="text-sm text-muted-foreground">
                        {filteredItems.length} {t('records')}
                    </div>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-muted-foreground animate-pulse">{t('loading')}</div>
                ) : filteredItems.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                        {searchQuery ? t('no_results') || 'Sonuç bulunamadı' : t('no_records')}
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {filteredItems.map((item) => (
                            <div
                                key={item.id}
                                id={`row-${item.id}`}
                                className={`p-6 transition-all duration-500 group ${item.id === highlightId
                                    ? 'bg-blue-500/10 ring-2 ring-blue-500 ring-inset shadow-lg scale-[1.01] rounded-lg my-1'
                                    : 'hover:bg-muted/50'
                                    }`}
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Calendar className="h-4 w-4" />
                                            <span>{new Date(item.date).toLocaleDateString("tr-TR")}</span>
                                            <span className="text-muted-foreground">•</span>
                                            <span>{item.year} / {item.month}. {t('month')} / {item.week}. {t('week')}</span>
                                        </div>
                                        <div className="font-medium text-foreground text-lg">
                                            {item.company}
                                        </div>
                                        <div className="text-sm text-muted-foreground font-mono">
                                            {t('col_waybill')}: <span className={item.id === highlightId ? 'font-bold text-foreground' : ''}>{item.waybillNo}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col md:items-end gap-1">
                                        <div className="text-2xl font-bold text-foreground">
                                            {item.stockCount.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">{t('pcs')}</span>
                                        </div>
                                        <div className={`text-sm font-medium ${getStatusColor(item.lastAction)}`}>
                                            {getStatusLabel(item.lastAction)}
                                        </div>
                                    </div>
                                </div>
                                {item.note && (
                                    <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                                        <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                                        <p>{item.note}</p>
                                    </div>
                                )}
                                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                                    <div>
                                        <span className="mr-1">{t('col_modifier')}:</span>
                                        <span className="text-foreground font-medium">{item.modifierName || 'Sistem'}</span>
                                    </div>
                                    {session?.user?.role === 'ADMIN' && (
                                        <button
                                            onClick={() => handleDeleteClick(item.id)}
                                            className="ml-4 flex items-center gap-1 text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                                            title={t('delete')}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            <span className="hidden sm:inline">{t('delete')}</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <DeleteConfirmModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, itemId: null })}
                onConfirm={handleConfirmDelete}
            />
        </div>
    );
}

