'use client';

import { useRouter } from 'next/navigation';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Download, Plus, Search, Calendar, Filter, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import AddItemModal from './add-item-modal';

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
}

export default function DashboardPage() {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [pageSize, setPageSize] = useState(20);
    const [currentPage, setCurrentPage] = useState(1);
    const router = useRouter();

    const fetchItems = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/inventory');
            if (res.ok) {
                const response = await res.json();
                // Handle new standardized API response format
                const data = response.data || response;
                setItems(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error("Failed to fetch inventory", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    // Reset to page 1 when search or pageSize changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, pageSize]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Paketlendi': return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
            case 'Beklemede': return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
            case 'Sevk Edildi': return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
            case 'İade': return 'bg-red-500/10 text-red-500 border border-red-500/20';
            default: return 'bg-gray-500/10 text-gray-500 border border-gray-500/20';
        }
    };

    const getCompanyInitial = (name: string) => name ? name.charAt(0).toUpperCase() : '?';

    const getCompanyColor = (name: string) => {
        const colors = ['bg-blue-600', 'bg-purple-600', 'bg-indigo-600', 'bg-emerald-600', 'bg-orange-600'];
        let hash = 0;
        if (!name) return colors[0];
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    const filteredItems = items.filter(item =>
        Object.values(item).some(val =>
            String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    // Pagination calculations
    const totalItems = filteredItems.length;
    const totalPages = pageSize === -1 ? 1 : Math.ceil(totalItems / pageSize);
    const startIndex = pageSize === -1 ? 0 : (currentPage - 1) * pageSize;
    const endIndex = pageSize === -1 ? totalItems : startIndex + pageSize;
    const visibleItems = filteredItems.slice(startIndex, endIndex);

    return (
        <div className="space-y-6">
            <AddItemModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchItems}
            />

            {/* Header Section */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Malzeme Stok Takibi</h2>
                    <p className="text-muted-foreground">Yan sanayi paketleme süreçlerini ve stok hareketlerini detaylı izleyin.</p>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors">
                        <Download className="h-4 w-4" />
                        Dışa Aktar
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        Yeni Görev
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Firma, İrsaliye No veya Referans ile ara..."
                            className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-4 text-sm text-foreground placeholder-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    <button className="flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground">
                        <Calendar className="h-4 w-4" />
                        Bu Hafta
                    </button>

                    <button className="flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground">
                        <Filter className="h-4 w-4" />
                        Tüm Firmalar
                    </button>

                    <button className="flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground">
                        <Filter className="h-4 w-4" />
                        İşlem Durumu
                    </button>

                    <button
                        onClick={fetchItems}
                        className="rounded-lg border border-input bg-background p-2.5 text-muted-foreground hover:text-foreground hover:bg-accent"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Data Table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground border-b border-border">
                            <tr>
                                <th className="px-6 py-4 font-medium">YIL / AY</th>
                                <th className="px-6 py-4 font-medium">HAFTA</th>
                                <th className="px-6 py-4 font-medium">TARİH</th>
                                <th className="px-6 py-4 font-medium">FİRMA</th>
                                <th className="px-6 py-4 font-medium">İRSALİYE NO</th>
                                <th className="px-6 py-4 font-medium">MALZEME REF</th>
                                <th className="px-6 py-4 font-medium text-right">STOK</th>
                                <th className="px-6 py-4 font-medium">SON İŞLEM</th>
                                <th className="px-6 py-4 font-medium">NOT</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {visibleItems.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={9} className="px-6 py-8 text-center text-muted-foreground">
                                        Kayıt bulunamadı. "Yeni Görev" butonu ile ekleme yapabilirsiniz.
                                    </td>
                                </tr>
                            )}
                            {visibleItems.map((item) => (
                                <motion.tr
                                    key={item.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    onClick={() => router.push(`/dashboard/inventory/${item.materialReference}`)}
                                    className="hover:bg-muted/50 transition-colors cursor-pointer group"
                                >
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-foreground">{item.year}</div>
                                        <div className="text-muted-foreground text-xs">/ {item.month < 10 ? `0${item.month}` : item.month}. Ay</div>
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground">{item.week}. Hafta</td>
                                    <td className="px-6 py-4 text-muted-foreground">
                                        {new Date(item.date).toLocaleDateString("tr-TR")}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-white ${getCompanyColor(item.company)}`}>
                                                {getCompanyInitial(item.company)}
                                            </div>
                                            <span className="text-foreground">{item.company}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-muted-foreground text-xs">{item.waybillNo}</td>
                                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                                        {item.materialReference}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-foreground">{item.stockCount.toLocaleString()}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getStatusColor(item.lastAction)}`}>
                                            {item.lastAction}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground max-w-xs truncate">{item.note}</td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination with Page Size Selector */}
                <div className="border-t border-border px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="text-sm text-muted-foreground">
                            Toplam <span className="font-medium text-foreground">{totalItems}</span> kayıt
                            {pageSize !== -1 && (
                                <span className="ml-2">
                                    ({startIndex + 1}-{Math.min(endIndex, totalItems)} arası gösteriliyor)
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Sayfa başına:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => setPageSize(Number(e.target.value))}
                                className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:border-blue-500 focus:outline-none"
                            >
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                                <option value={-1}>Tümü</option>
                            </select>
                        </div>
                    </div>
                    {pageSize !== -1 && totalPages > 1 && (
                        <div className="flex gap-2 items-center">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="rounded-lg border border-input bg-background p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <span className="text-sm text-muted-foreground">
                                Sayfa <span className="font-medium text-foreground">{currentPage}</span> / {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="rounded-lg border border-input bg-background p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

