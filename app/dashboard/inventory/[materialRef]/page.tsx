'use client';

import { useState, useEffect, use } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, FileText, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

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
    const { data: session } = useSession();
    const router = useRouter();
    // Decode URL encoded material reference
    const materialRef = decodeURIComponent(rawRef);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/inventory');
            if (res.ok) {
                const response = await res.json();
                // Handle new standardized API response format
                const data = response.data || response;
                const allItems = Array.isArray(data) ? data : [];
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

    const handleDelete = async (id: string) => {
        if (!confirm("Bu kaydı silmek istediğinizden emin misiniz?")) return;

        try {
            const res = await fetch(`/api/inventory?id=${id}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                alert("Kayıt silindi.");
                fetchHistory();
            } else {
                const txt = await res.text();
                alert(`Silme başarısız: ${txt}`);
            }
        } catch (error) {
            console.error(error);
            alert("Hata oluştu.");
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Paketlendi': return 'text-emerald-500';
            case 'Beklemede': return 'text-amber-500';
            case 'Sevk Edildi': return 'text-blue-500';
            case 'İade': return 'text-red-500';
            default: return 'text-gray-500';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link
                    href="/dashboard/inventory"
                    className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Malzeme Geçmişi</h2>
                    <p className="text-muted-foreground font-mono">{materialRef}</p>
                </div>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                <div className="p-6 border-b border-border">
                    <h3 className="font-semibold text-foreground">Hareket Kayıtları</h3>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-muted-foreground">Yükleniyor...</div>
                ) : items.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">Bu malzeme için kayıt bulunamadı.</div>
                ) : (
                    <div className="divide-y divide-border">
                        {items.map((item) => (
                            <div key={item.id} className="p-6 hover:bg-muted/50 transition-colors group">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Calendar className="h-4 w-4" />
                                            <span>{new Date(item.date).toLocaleDateString("tr-TR")}</span>
                                            <span className="text-muted-foreground">•</span>
                                            <span>{item.year} / {item.month}. Ay / {item.week}. Hafta</span>
                                        </div>
                                        <div className="font-medium text-foreground text-lg">
                                            {item.company}
                                        </div>
                                        <div className="text-sm text-muted-foreground font-mono">
                                            İrsaliye: {item.waybillNo}
                                        </div>
                                    </div>

                                    <div className="flex flex-col md:items-end gap-1">
                                        <div className="text-2xl font-bold text-foreground">
                                            {item.stockCount.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">Adet</span>
                                        </div>
                                        <div className={`text-sm font-medium ${getStatusColor(item.lastAction)}`}>
                                            {item.lastAction}
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
                                        <span className="mr-1">İşlem Yapan:</span>
                                        <span className="text-foreground font-medium">{item.modifierName || 'Sistem'}</span>
                                    </div>
                                    {session?.user?.role === 'ADMIN' && (
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="ml-4 flex items-center gap-1 text-red-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            Sil
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
