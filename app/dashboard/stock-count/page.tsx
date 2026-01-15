'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/components/language-provider';
import { useToast } from '@/components/toast';
import {
    Search, Save, RotateCcw, CheckCircle, AlertTriangle, Clock, FileSpreadsheet,
    Download, BarChart3, Package, TrendingUp, TrendingDown, Filter, X, FileText, FileIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface StockCountItem {
    id: string;
    materialReference: string;
    company: string;
    location?: string;
    systemStock: number;
    countedStock: number | '';
    status: 'PENDING' | 'MATCH' | 'MISMATCH';
    difference?: number;
}

type FilterStatus = 'ALL' | 'PENDING' | 'MATCH' | 'MISMATCH';

export default function StockCountPage() {
    const { t } = useLanguage();
    const { showToast } = useToast();
    const { data: session } = useSession();
    const [items, setItems] = useState<StockCountItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
    const [showReport, setShowReport] = useState(false);
    const [countDate, setCountDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    const loadInventory = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/inventory?limit=500&view=summary');
            if (res.ok) {
                const data = await res.json();
                const inventory = data.data?.items || [];

                const countItems: StockCountItem[] = inventory.map((item: any) => ({
                    id: item.materialReference,
                    materialReference: item.materialReference,
                    company: item.company || '',
                    location: item.location,
                    systemStock: item.stockCount || 0,
                    countedStock: '',
                    status: 'PENDING' as const
                }));

                setItems(countItems);
            }
        } catch (error) {
            console.error("Stock Count Load Error:", error);
            showToast('Envanter yüklenemedi', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (session) {
            loadInventory();
        }
    }, [session]);

    const handleCountChange = (id: string, value: string) => {
        const numValue = parseInt(value);
        setItems(items.map(item => {
            if (item.id === id) {
                const isMatch = numValue === item.systemStock;
                const difference = value === '' ? undefined : numValue - item.systemStock;
                return {
                    ...item,
                    countedStock: value === '' ? '' : numValue,
                    status: value === '' ? 'PENDING' : (isMatch ? 'MATCH' : 'MISMATCH'),
                    difference
                };
            }
            return item;
        }));
    };

    // Computed stats
    const stats = {
        total: items.length,
        pending: items.filter(i => i.status === 'PENDING').length,
        match: items.filter(i => i.status === 'MATCH').length,
        mismatch: items.filter(i => i.status === 'MISMATCH').length,
        progress: items.length > 0 ? Math.round(((items.length - items.filter(i => i.status === 'PENDING').length) / items.length) * 100) : 0,
        totalDifference: items.filter(i => i.status === 'MISMATCH').reduce((sum, i) => sum + (i.difference || 0), 0),
        positiveDiscrepancies: items.filter(i => i.status === 'MISMATCH' && (i.difference || 0) > 0).length,
        negativeDiscrepancies: items.filter(i => i.status === 'MISMATCH' && (i.difference || 0) < 0).length,
    };

    // Filtered items
    const filteredItems = items
        .filter(i => statusFilter === 'ALL' || i.status === statusFilter)
        .filter(i =>
            i.materialReference.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (i.location && i.location.toLowerCase().includes(searchTerm.toLowerCase()))
        );

    // Export functions
    const exportToCSV = () => {
        const csvContent = [
            ['Malzeme Referansı', 'Konum', 'Sistem Stoğu', 'Sayım Sonucu', 'Fark', 'Durum'].join(';'),
            ...items.filter(i => i.status !== 'PENDING').map(item => [
                item.materialReference,
                item.location || '-',
                item.systemStock,
                item.countedStock,
                item.difference || 0,
                item.status === 'MATCH' ? 'Eşleşti' : 'Fark Var'
            ].join(';'))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `stok_sayim_raporu_${countDate}.csv`;
        link.click();
        showToast('Rapor indirildi', 'success');
    };

    const exportDiscrepancyReport = () => {
        const discrepancies = items.filter(i => i.status === 'MISMATCH');

        const reportContent = [
            `STOK SAYIM FARK RAPORU`,
            `Tarih: ${format(new Date(countDate), 'dd MMMM yyyy', { locale: tr })}`,
            `Sayımı Yapan: ${session?.user?.name || session?.user?.email}`,
            ``,
            `ÖZET`,
            `Toplam Malzeme: ${items.length}`,
            `Sayılan: ${items.length - stats.pending}`,
            `Eşleşen: ${stats.match}`,
            `Farklı: ${stats.mismatch}`,
            `Toplam Fark: ${stats.totalDifference > 0 ? '+' : ''}${stats.totalDifference}`,
            ``,
            `FARK DETAYLARI`,
            `${'='.repeat(80)}`,
            ...discrepancies.map(item =>
                `${item.materialReference.padEnd(30)} | Sistem: ${String(item.systemStock).padStart(8)} | Sayım: ${String(item.countedStock).padStart(8)} | Fark: ${item.difference! > 0 ? '+' : ''}${item.difference}`
            ),
            `${'='.repeat(80)}`,
        ].join('\n');

        const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `fark_raporu_${countDate}.txt`;
        link.click();
        showToast('Fark raporu indirildi', 'success');
    };

    // PDF Export
    const exportToPDF = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('STOK SAYIM RAPORU', pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Tarih: ${format(new Date(countDate), 'dd.MM.yyyy')}`, 14, 32);
        doc.text(`Sayımı Yapan: ${session?.user?.name || 'Bilinmiyor'}`, 14, 38);
        doc.text(`Oluşturulma: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, pageWidth - 14, 32, { align: 'right' });

        // Summary Box
        doc.setDrawColor(200);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, 45, pageWidth - 28, 25, 3, 3, 'FD');

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        const summaryY = 55;
        doc.text(`Toplam: ${stats.total}`, 20, summaryY);
        doc.text(`Sayılan: ${items.length - stats.pending}`, 55, summaryY);
        doc.setTextColor(34, 197, 94);
        doc.text(`Eşleşen: ${stats.match}`, 95, summaryY);
        doc.setTextColor(239, 68, 68);
        doc.text(`Farklı: ${stats.mismatch}`, 135, summaryY);
        doc.setTextColor(0);
        doc.text(`Net Fark: ${stats.totalDifference > 0 ? '+' : ''}${stats.totalDifference}`, 170, summaryY);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`İlerleme: %${stats.progress}`, 20, 63);

        // Table
        const tableData = items.filter(i => i.status !== 'PENDING').map(item => [
            item.materialReference,
            item.company || '-',
            item.location || '-',
            item.systemStock.toString(),
            item.countedStock.toString(),
            item.difference !== undefined ? (item.difference > 0 ? '+' : '') + item.difference : '0',
            item.status === 'MATCH' ? 'Eşleşti' : 'Fark Var'
        ]);

        autoTable(doc, {
            head: [['Malzeme Ref', 'Firma', 'Konum', 'Sistem', 'Sayım', 'Fark', 'Durum']],
            body: tableData,
            startY: 75,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { cellWidth: 35 },
                3: { halign: 'right' },
                4: { halign: 'right' },
                5: { halign: 'center' },
                6: { cellWidth: 22 }
            },
            didParseCell: (data) => {
                if (data.column.index === 6 && data.section === 'body') {
                    if (data.cell.raw === 'Eşleşti') {
                        data.cell.styles.textColor = [34, 197, 94];
                    } else {
                        data.cell.styles.textColor = [239, 68, 68];
                    }
                }
                if (data.column.index === 5 && data.section === 'body') {
                    const val = data.cell.raw as string;
                    if (val.startsWith('+')) {
                        data.cell.styles.textColor = [34, 197, 94];
                    } else if (val.startsWith('-')) {
                        data.cell.styles.textColor = [239, 68, 68];
                    }
                }
            }
        });

        // Footer
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(
                `Sayfa ${i} / ${pageCount} - Project Track Base`,
                pageWidth / 2,
                doc.internal.pageSize.getHeight() - 10,
                { align: 'center' }
            );
        }

        doc.save(`stok_sayim_raporu_${countDate}.pdf`);
        showToast('PDF raporu indirildi', 'success');
    };

    // Reset all counts
    const resetCounts = () => {
        setItems(items.map(item => ({
            ...item,
            countedStock: '',
            status: 'PENDING' as const,
            difference: undefined
        })));
        showToast('Sayımlar sıfırlandı', 'info');
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Stok Sayım Modülü</h2>
                    <p className="text-muted-foreground">Fiziksel sayım ve sistem karşılaştırması</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <input
                        type="date"
                        value={countDate}
                        onChange={(e) => setCountDate(e.target.value)}
                        className="px-3 py-2 text-sm rounded-lg border border-border bg-background"
                    />
                    <button
                        onClick={resetCounts}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Sıfırla
                    </button>
                    <button
                        onClick={loadInventory}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Yenile
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                            <Package className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                            <p className="text-xs text-muted-foreground">Toplam</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/10">
                            <Clock className="h-5 w-5 text-amber-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
                            <p className="text-xs text-muted-foreground">Bekleyen</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                            <CheckCircle className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.match}</p>
                            <p className="text-xs text-muted-foreground">Eşleşen</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-red-500/10">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{stats.mismatch}</p>
                            <p className="text-xs text-muted-foreground">Farklı</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                            <BarChart3 className="h-5 w-5 text-purple-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">%{stats.progress}</p>
                            <p className="text-xs text-muted-foreground">Tamamlanan</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">Sayım İlerlemesi</span>
                    <span className="text-sm text-muted-foreground">
                        {items.length - stats.pending} / {items.length} sayıldı
                    </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                        style={{ width: `${stats.progress}%` }}
                    />
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        {stats.match} Eşleşen
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        {stats.mismatch} Farklı
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        {stats.pending} Bekleyen
                    </span>
                </div>
            </div>

            {/* Filter / Search / Export Bar */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Malzeme Referansı veya Konum Ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Status Filter Buttons */}
                        <div className="flex items-center border border-border rounded-lg overflow-hidden">
                            {(['ALL', 'PENDING', 'MATCH', 'MISMATCH'] as FilterStatus[]).map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-3 py-2 text-xs font-medium transition-colors ${statusFilter === status
                                        ? status === 'MATCH' ? 'bg-emerald-500/20 text-emerald-600'
                                            : status === 'MISMATCH' ? 'bg-red-500/20 text-red-600'
                                                : status === 'PENDING' ? 'bg-amber-500/20 text-amber-600'
                                                    : 'bg-blue-500/20 text-blue-600'
                                        : 'hover:bg-muted'
                                        }`}
                                >
                                    {status === 'ALL' ? 'Tümü' : status === 'PENDING' ? 'Bekleyen' : status === 'MATCH' ? 'Eşleşen' : 'Farklı'}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={exportToCSV}
                            disabled={stats.pending === stats.total}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors disabled:opacity-50"
                            title="CSV olarak dışa aktar"
                        >
                            <FileSpreadsheet className="h-4 w-4" />
                            <span className="hidden sm:inline">CSV</span>
                        </button>

                        <button
                            onClick={exportToPDF}
                            disabled={stats.pending === stats.total}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-600 text-sm hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                            title="PDF olarak dışa aktar"
                        >
                            <FileIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">PDF</span>
                        </button>

                        <button
                            onClick={exportDiscrepancyReport}
                            disabled={stats.mismatch === 0}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 text-sm hover:bg-red-500/20 transition-colors disabled:opacity-50"
                            title="Fark raporu indir"
                        >
                            <FileText className="h-4 w-4" />
                            <span className="hidden sm:inline">Fark Raporu</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Discrepancy Summary (if any) */}
            {stats.mismatch > 0 && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                    <div className="flex items-start gap-4">
                        <div className="p-2 rounded-lg bg-red-500/10">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-semibold text-foreground mb-1">Stok Farkları Tespit Edildi</h4>
                            <p className="text-sm text-muted-foreground mb-3">
                                {stats.mismatch} malzemede toplam <strong className={stats.totalDifference >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                    {stats.totalDifference > 0 ? '+' : ''}{stats.totalDifference}
                                </strong> adet fark bulundu.
                            </p>
                            <div className="flex items-center gap-4 text-sm">
                                <span className="flex items-center gap-1.5">
                                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                                    <span>{stats.positiveDiscrepancies} fazla</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <TrendingDown className="h-4 w-4 text-red-500" />
                                    <span>{stats.negativeDiscrepancies} eksik</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Counting Table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground border-b border-border">
                            <tr>
                                <th className="px-6 py-4 font-medium">Malzeme</th>
                                <th className="px-6 py-4 font-medium">Firma</th>
                                <th className="px-6 py-4 font-medium">Konum</th>
                                <th className="px-6 py-4 font-medium text-right">Sistem Stoğu</th>
                                <th className="px-6 py-4 font-medium text-right w-40">Sayım Sonucu</th>
                                <th className="px-6 py-4 font-medium text-center w-32">Fark</th>
                                <th className="px-6 py-4 font-medium w-32">Durum</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                                        <RotateCcw className="h-6 w-6 animate-spin mx-auto mb-2" />
                                        Yükleniyor...
                                    </td>
                                </tr>
                            ) : filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                                        <Package className="h-6 w-6 mx-auto mb-2 opacity-50" />
                                        Kayıt bulunamadı
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map(item => (
                                    <tr
                                        key={item.id}
                                        className={`hover:bg-muted/50 transition-colors ${item.status === 'MISMATCH' ? 'bg-red-500/5' :
                                            item.status === 'MATCH' ? 'bg-emerald-500/5' : ''
                                            }`}
                                    >
                                        <td className="px-6 py-4 font-medium font-mono">{item.materialReference}</td>
                                        <td className="px-6 py-4 text-muted-foreground">{item.company || '-'}</td>
                                        <td className="px-6 py-4 text-muted-foreground">{item.location || '-'}</td>
                                        <td className="px-6 py-4 text-right font-mono text-lg font-bold">{item.systemStock}</td>
                                        <td className="px-6 py-4">
                                            <input
                                                type="number"
                                                min="0"
                                                value={item.countedStock}
                                                onChange={(e) => handleCountChange(item.id, e.target.value)}
                                                className={`w-full text-right rounded-md border px-3 py-1.5 focus:outline-none font-bold font-mono ${item.status === 'MATCH' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700' :
                                                    item.status === 'MISMATCH' ? 'border-red-500 bg-red-500/10 text-red-700' :
                                                        'border-input bg-background'
                                                    }`}
                                                placeholder="0"
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-center font-mono font-bold">
                                            {item.status === 'MISMATCH' && (
                                                <span className={item.difference! > 0 ? 'text-emerald-600' : 'text-red-600'}>
                                                    {item.difference! > 0 ? '+' : ''}{item.difference}
                                                </span>
                                            )}
                                            {item.status === 'MATCH' && <span className="text-emerald-600">0</span>}
                                            {item.status === 'PENDING' && <span className="text-muted-foreground">-</span>}
                                        </td>
                                        <td className="px-6 py-4">
                                            {item.status === 'MATCH' && (
                                                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                                                    <CheckCircle className="h-4 w-4" /> Eşleşti
                                                </span>
                                            )}
                                            {item.status === 'MISMATCH' && (
                                                <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                                                    <AlertTriangle className="h-4 w-4" /> Fark Var
                                                </span>
                                            )}
                                            {item.status === 'PENDING' && (
                                                <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                                                    <Clock className="h-4 w-4" /> Bekliyor
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Stats */}
                <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                        {filteredItems.length} kayıt gösteriliyor
                    </span>
                    <span className="text-muted-foreground">
                        Sayım Tarihi: {format(new Date(countDate), 'dd MMMM yyyy', { locale: tr })}
                    </span>
                </div>
            </div>
        </div>
    );
}
