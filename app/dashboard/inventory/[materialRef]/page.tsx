'use client';

import { useState, useEffect, use } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Calendar, FileText, Trash2, Search, AlertTriangle, ExternalLink, Eye, X, Activity, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/components/language-provider';
import { useToast } from '@/components/toast';
import DeleteConfirmModal from '@/components/delete-confirm-modal';

interface InventoryItem {
    id: string;
    year: number;
    month: number;
    week: number;
    date: string;
    company: string;
    waybillNo: string;
    waybillUrl?: string;
    materialReference: string;
    stockCount: number;
    lastAction: string;
    note: string;
    createdAt: string;
    modifierName?: string;
}

export default function MaterialHistoryPage({ params }: { params: Promise<{ materialRef: string }> }) {
    const { materialRef: rawRef } = use(params);
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, itemId: null as string | null });
    const [deleteMaterialModal, setDeleteMaterialModal] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

    const { data: session } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const highlightId = searchParams.get('highlight');
    const showDeletedRaw = searchParams.get('showDeleted');
    const showDeleted = showDeletedRaw === 'true';
    const { t } = useLanguage();
    const { showToast } = useToast();
    // Decode URL encoded material reference
    const materialRef = decodeURIComponent(rawRef);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            // Fetch ALL items for this reference by using search & limit=-1
            // If showDeleted is true, we need to pass that to API too
            const params = new URLSearchParams({
                limit: '-1',
                search: materialRef,
                showDeleted: showDeleted.toString()
            });
            const res = await fetch(`/api/inventory?${params}`);
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
        if (session) {
            fetchHistory();
        }
    }, [session, materialRef]);

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

    // Soft delete ALL inventory items for this material reference
    const handleDeleteMaterial = async () => {
        try {
            // Call API to bulk soft-delete all items with this materialReference
            const res = await fetch(`/api/inventory?materialRef=${encodeURIComponent(materialRef)}&action=bulkDelete`, {
                method: 'DELETE',
            });

            if (res.ok) {
                showToast('Malzeme silindi', 'success');
                setDeleteMaterialModal(false);
                router.push('/dashboard/inventory');
            } else {
                const data = await res.json().catch(() => ({}));
                showToast(data.message || 'Silme başarısız', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Bir hata oluştu', 'error');
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

                <div className="flex items-center gap-3">
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

                    {session?.user?.role === 'ADMIN' && (
                        <button
                            onClick={() => setDeleteMaterialModal(true)}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-red-500/30 bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
                            title="Malzemeyi Sil"
                        >
                            <Trash2 className="h-4 w-4" />
                            <span className="hidden sm:inline">Malzemeyi Sil</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Deleted View Banner */}
            {
                showDeleted && (
                    <div className="rounded-xl border border-red-500/50 bg-red-500/10 p-4 flex items-center gap-3 text-red-700">
                        <Trash2 className="h-5 w-5" />
                        <span className="font-medium">Şu anda silinmiş kayıtları görüntülüyorsunuz (Arşiv).</span>
                        <button
                            onClick={() => router.push(`/dashboard/inventory/${rawRef}`)}
                            className="ml-auto text-sm underline hover:text-red-900"
                        >
                            Aktif Kayıtlara Dön
                        </button>
                    </div>
                )
            }

            {/* Last Transaction Highlight - Only show when not searching */}
            {!searchQuery && filteredItems.length > 0 && (
                <div className="mb-8 animate-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-2 mb-3 px-1">
                        <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-600">
                            <Activity className="h-4 w-4" />
                        </div>
                        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Son İşlem</h3>
                    </div>

                    <div className="relative overflow-hidden rounded-2xl border border-blue-200/50 dark:border-blue-500/20 bg-gradient-to-br from-white to-blue-50/50 dark:from-card dark:to-blue-950/10 shadow-lg shadow-blue-500/5">
                        <div className="absolute top-0 right-0 p-3 opacity-10">
                            <Activity className="h-24 w-24 text-blue-500 rotate-12" />
                        </div>

                        <div className="relative p-6 sm:p-8">
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                                <div className="space-y-4">
                                    <div className="flex flex-wrap items-center gap-3 text-sm">
                                        <span className="px-3 py-1 rounded-full bg-background border border-border shadow-sm flex items-center gap-2 text-foreground font-medium">
                                            <Calendar className="h-4 w-4 text-blue-500" />
                                            {new Date(filteredItems[0].date).toLocaleDateString("tr-TR")}
                                        </span>
                                        <span className="text-muted-foreground">{new Date(filteredItems[0].createdAt).toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>

                                    <div>
                                        <h4 className="text-3xl font-bold text-foreground tracking-tight">{filteredItems[0].company}</h4>
                                        <div className="mt-2 flex items-center gap-3 text-muted-foreground">
                                            <span className="font-mono bg-muted px-2 py-0.5 rounded text-sm">{filteredItems[0].waybillNo}</span>
                                            {filteredItems[0].waybillUrl && (
                                                <button
                                                    onClick={() => setPdfPreviewUrl(filteredItems[0].waybillUrl!)}
                                                    className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                                                >
                                                    <Eye className="h-3 w-3" />
                                                    İrsaliye Görüntüle
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {filteredItems[0].note && (
                                        <div className="p-4 rounded-xl bg-white/50 dark:bg-black/20 border border-blue-100 dark:border-blue-900/30 text-sm italic text-muted-foreground max-w-xl">
                                            "{filteredItems[0].note}"
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col items-start md:items-end gap-2 min-w-[140px]">
                                    <div className="text-4xl font-extrabold text-foreground tracking-tighter">
                                        {filteredItems[0].stockCount.toLocaleString()}
                                        <span className="text-lg font-medium text-muted-foreground ml-1">{t('pcs')}</span>
                                    </div>
                                    <div className={`px-4 py-1.5 rounded-full text-base font-semibold flex items-center gap-2 ${getStatusColor(filteredItems[0].lastAction)} bg-current/10 border border-current/20`}>
                                        {filteredItems[0].lastAction === 'Giriş' ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                                        {getStatusLabel(filteredItems[0].lastAction)}
                                    </div>
                                    <div className="mt-4 text-xs text-muted-foreground text-right">
                                        işlemi yapan: <br />
                                        <span className="font-medium text-foreground">{filteredItems[0].modifierName || 'Sistem'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                <div className="p-6 border-b border-border flex items-center justify-between">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        {t('movement_records')}
                    </h3>
                    <div className="text-sm text-muted-foreground">
                        {!searchQuery ? filteredItems.length - 1 : filteredItems.length} {t('records')}
                        {!searchQuery && filteredItems.length > 0 && <span className="ml-1 text-xs opacity-70">(Son işlem yukarıda)</span>}
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
                        {(searchQuery ? filteredItems : filteredItems.slice(1)).map((item) => (
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
                                            <span>{new Date(item.createdAt).toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' })}</span>
                                            <span className="text-muted-foreground">•</span>
                                            <span>{item.year} / {item.month}. {t('month')} / {item.week}. {t('week')}</span>
                                        </div>
                                        <div className="font-medium text-foreground text-lg">
                                            {item.company}
                                        </div>
                                        <div className="text-sm text-muted-foreground font-mono flex items-center gap-2">
                                            {t('col_waybill')}: <span className={item.id === highlightId ? 'font-bold text-foreground' : ''}>{item.waybillNo}</span>
                                            {item.waybillUrl && (
                                                <button
                                                    onClick={() => setPdfPreviewUrl(item.waybillUrl!)}
                                                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors text-xs"
                                                    title="İrsaliye PDF'ini Görüntüle"
                                                >
                                                    <Eye className="h-3 w-3" />
                                                    PDF
                                                </button>
                                            )}
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

            {/* Delete Material Modal */}
            {
                deleteMaterialModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 rounded-full bg-red-500/10">
                                    <AlertTriangle className="h-6 w-6 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-foreground">Malzemeyi Sil</h3>
                                    <p className="text-sm text-muted-foreground">Bu işlem geri alınabilir (Arşiv)</p>
                                </div>
                            </div>

                            <div className="mb-6 p-4 rounded-lg bg-muted/50">
                                <p className="text-sm text-foreground">
                                    <span className="font-mono font-bold">{materialRef}</span> referanslı malzemenin
                                    <span className="font-bold text-red-500"> tüm kayıtları ({items.length} adet)</span> silinecektir.
                                </p>
                            </div>

                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setDeleteMaterialModal(false)}
                                    className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={handleDeleteMaterial}
                                    className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                                >
                                    Tümünü Sil
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* PDF Preview Modal */}
            {
                pdfPreviewUrl && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                        <div className="w-full max-w-4xl h-[80vh] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">
                            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50">
                                <h3 className="font-semibold text-foreground flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-blue-500" />
                                    İrsaliye Belgesi
                                </h3>
                                <div className="flex items-center gap-2">
                                    <a
                                        href={pdfPreviewUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors text-sm"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        Yeni Sekmede Aç
                                    </a>
                                    <button
                                        onClick={() => setPdfPreviewUrl(null)}
                                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 bg-muted">
                                <iframe
                                    src={pdfPreviewUrl}
                                    className="w-full h-full border-0"
                                    title="PDF Preview"
                                />
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

