'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/components/language-provider';
import { useToast } from '@/components/toast';
import {
    Search, Save, RotateCcw, CheckCircle, AlertTriangle, Clock, FileSpreadsheet,
    Download, BarChart3, Package, TrendingUp, TrendingDown, Filter, X, FileText, FileIcon,
    Cloud, CloudOff, PlayCircle, ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ConfirmModal from '@/components/confirm-modal';

interface StockCountItem {
    id: string; // materialReference
    materialReference: string;
    company: string;
    location?: string;
    systemStock: number;
    countedStock: number | '';
    status: 'PENDING' | 'MATCH' | 'MISMATCH';
    difference?: number;
    saved?: boolean; // UI state for save status
    material?: {
        abcClass: string | null;
        minStock: number | null;
        unit: string;
        defaultLocation: string | null;
        description: string | null;
    } | null;
}

type FilterStatus = 'ALL' | 'PENDING' | 'MATCH' | 'MISMATCH';

export default function StockCountPage() {
    const { t } = useLanguage();
    const { showToast } = useToast();
    const { data: session } = useSession();

    // State
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [sessionStatus, setSessionStatus] = useState<'LOADING' | 'ACTIVE' | 'NOT_STARTED'>('LOADING');
    const [items, setItems] = useState<StockCountItem[]>([]);
    const [blindMode, setBlindMode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
    const [countDate, setCountDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [savingItem, setSavingItem] = useState<string | null>(null);

    // Debounce Ref
    const saveTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

    // New States for History View
    const [activeTab, setActiveTab] = useState<'active' | 'history'>('history');
    const [historySessions, setHistorySessions] = useState<any[]>([]);

    // Today's Session State for Landing Page
    const [todayStatus, setTodayStatus] = useState<'LOADING' | 'EXISTS' | 'NONE'>('LOADING');
    const [todaySessionData, setTodaySessionData] = useState<any>(null);
    const [endSessionModal, setEndSessionModal] = useState<{ isOpen: boolean; sessionId: string | null }>({ isOpen: false, sessionId: null });

    // Initial Load - Check both history and today's status
    useEffect(() => {
        if (session) {
            loadHistory();
            checkTodayStatus();
        }
    }, [session]);

    // When switching to active tab, ensure data is loaded for selected countDate
    useEffect(() => {
        if (activeTab === 'active' && session && countDate) {
            loadSessionForDate(countDate);
        }
    }, [activeTab, countDate, session]);

    const checkTodayStatus = async () => {
        const today = format(new Date(), 'yyyy-MM-dd');
        setTodayStatus('LOADING');
        try {
            const res = await fetch(`/api/stock-count/session?date=${today}`);
            const data = await res.json();
            if (data && data.id) {
                setTodayStatus('EXISTS');
                setTodaySessionData(data);
            } else {
                setTodayStatus('NONE');
                setTodaySessionData(null);
            }
        } catch (error) {
            console.error("Today status check failed", error);
        }
    };

    const loadSessionForDate = async (date: string) => {
        setLoading(true);
        setSessionStatus('LOADING');
        try {
            const res = await fetch(`/api/stock-count/session?date=${date}`);
            const data = await res.json();

            if (data && data.id) {
                // Session exists, load it
                setSessionId(data.id);
                setSessionStatus('ACTIVE');
                await loadInventoryWithSession(data.entries || []);
            } else {
                // No session
                setSessionId(null);
                setSessionStatus('NOT_STARTED');
                setItems([]); // Clear items if no session
            }
        } catch (error) {
            console.error("Session check error:", error);
            showToast('Oturum kontrolü yapılamadı', 'error');
        } finally {
            setLoading(false);
        }
    };


    const startSession = async () => {
        setLoading(true);
        try {
            // Ensure we use today's date if starting new from landing
            const today = format(new Date(), 'yyyy-MM-dd');
            setCountDate(today);

            const res = await fetch(`/api/stock-count/session?date=${today}&create=true`);
            if (res.ok) {
                const data = await res.json();
                setSessionId(data.id);
                setSessionStatus('ACTIVE');
                await loadInventoryWithSession([]);

                // Update today status
                setTodayStatus('EXISTS');
                setTodaySessionData(data);
                setActiveTab('active'); // Switch to active view

                showToast('Sayım oturumu başlatıldı', 'success');
            } else {
                showToast('Oturum başlatılamadı', 'error');
            }
        } catch (error) {
            console.error("Start session error:", error);
            showToast('Bir hata oluştu', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmEndSession = async () => {
        const sid = endSessionModal.sessionId;
        if (!sid) return;

        setEndSessionModal({ isOpen: false, sessionId: null });
        setLoading(true);

        try {
            const res = await fetch('/api/stock-count/session', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: sid, action: 'complete' })
            });

            if (res.ok) {
                showToast('Sayım tamamlandı', 'success');
                setTodaySessionData((prev: any) => ({ ...prev, status: 'COMPLETED' }));
                loadHistory();
            } else {
                showToast('Sayım tamamlanamadı', 'error');
            }
        } catch (error) {
            showToast('Bağlantı hatası', 'error');
        } finally {
            setLoading(false);
        }
    };



    const loadInventoryWithSession = async (existingEntries: any[]) => {
        try {
            const res = await fetch('/api/inventory?limit=500&view=summary');
            if (res.ok) {
                const data = await res.json();
                const inventory = data.data?.items || [];

                // Create a map of existing entries for fast lookup
                const entryMap = new Map(existingEntries.map((e: any) => [e.materialReference, e]));

                const combinedItems: StockCountItem[] = inventory.map((item: any) => {
                    const entry = entryMap.get(item.materialReference);

                    if (entry) {
                        return {
                            id: item.materialReference,
                            materialReference: item.materialReference,
                            company: item.company || '',
                            location: item.location,
                            systemStock: entry.systemStock, // Use snapshot system stock
                            countedStock: entry.countedStock,
                            status: entry.status as any,
                            difference: entry.difference,
                            saved: true,
                            material: item.material // Passthrough material data
                        };
                    } else {
                        return {
                            id: item.materialReference,
                            materialReference: item.materialReference,
                            company: item.company || '',
                            location: item.location,
                            systemStock: item.stockCount || 0,
                            countedStock: '',
                            status: 'PENDING',
                            material: item.material
                        };
                    }
                });

                setItems(combinedItems);
            }
        } catch (error) {
            console.error("Inventory load error:", error);
            showToast('Envanter listesi yüklenemedi', 'error');
        }
    };

    const saveCount = async (id: string, countedVal: number | '', systemStock: number) => {
        if (!sessionId || countedVal === '') return;

        setSavingItem(id);

        try {
            const res = await fetch('/api/stock-count/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    materialReference: id,
                    countedStock: countedVal,
                    systemStock: systemStock,
                    note: 'Kullanıcı sayımı'
                })
            });

            if (res.ok) {
                // Update saved state locally
                setItems(prev => prev.map(item =>
                    item.id === id ? { ...item, saved: true } : item
                ));
            } else {
                showToast('Kaydedilemedi', 'error');
            }
        } catch (error) {
            console.error("Save error:", error);
            showToast('Bağlantı hatası', 'error');
        } finally {
            setSavingItem(null);
        }
    };

    const loadHistory = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/stock-count/session?mode=history');
            if (res.ok) {
                const data = await res.json();
                setHistorySessions(data);
            }
        } catch (error) {
            console.error("History load error:", error);
            showToast('Geçmiş yüklenemedi', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleHistoryClick = (dateStr: string) => {
        setCountDate(format(new Date(dateStr), 'yyyy-MM-dd'));
        setActiveTab('active');
    };

    const handleCountChange = (id: string, value: string) => {
        const numValue = value === '' ? '' : parseInt(value);

        // Update UI immediately (optimistic)
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const isMatch = numValue === '' ? false : numValue === item.systemStock;
                const status = numValue === '' ? 'PENDING' : (isMatch ? 'MATCH' : 'MISMATCH');
                const difference = numValue === '' ? undefined : (numValue as number) - item.systemStock;

                return {
                    ...item,
                    countedStock: numValue,
                    status,
                    difference,
                    saved: false // Mark as unsaved until API responds
                };
            }
            return item;
        }));

        // Debounce or trigger save
        if (value !== '') {
            const item = items.find(i => i.id === id);
            if (item) {
                // Clear existing timeout
                if (saveTimeouts.current.has(id)) {
                    clearTimeout(saveTimeouts.current.get(id)!);
                }

                // Set new timeout
                const timeout = setTimeout(() => {
                    saveCount(id, numValue, item.systemStock);
                    saveTimeouts.current.delete(id);
                }, 1000); // 1s delay

                saveTimeouts.current.set(id, timeout);
            }
        }
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

    // Export functions (Existing)
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

    const exportToPDF = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('STOK SAYIM RAPORU', pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Tarih: ${format(new Date(countDate), 'dd.MM.yyyy')}`, 14, 32);
        doc.text(`Sayımı Yapan: ${session?.user?.name || 'Bilinmiyor'}`, 14, 38);
        doc.text(`Oluşturulma: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, pageWidth - 14, 32, { align: 'right' });

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

        doc.save(`stok_sayim_raporu_${countDate}.pdf`);
        showToast('PDF raporu indirildi', 'success');
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    {activeTab === 'active' && (
                        <button
                            onClick={() => {
                                setActiveTab('history');
                                checkTodayStatus();
                                loadHistory();
                            }}
                            className="p-2 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                        </button>
                    )}
                    <div>
                        <h2 className="text-2xl font-bold text-foreground">Stok Sayım Modülü</h2>
                        <p className="text-muted-foreground">Fiziksel sayım ve sistem karşılaştırması</p>
                    </div>
                </div>

                {/* View Tabs & Blind Mode Toggle (Only in Active Mode) */}
                <div className="flex items-center gap-4">
                    {activeTab === 'active' && sessionStatus === 'ACTIVE' && (
                        <button
                            onClick={() => setBlindMode(!blindMode)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${blindMode
                                ? 'bg-purple-500/10 text-purple-600 border-purple-500/30'
                                : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                                }`}
                            title="Sistem stoğunu gizle (Kör Sayım)"
                        >
                            {blindMode ? <CloudOff className="h-4 w-4" /> : <Cloud className="h-4 w-4" />}
                            {blindMode ? 'Kör Sayım: AÇIK' : 'Kör Sayım: KAPALI'}
                        </button>
                    )}
                </div>
            </div>

            {/* Content Switch */}
            {activeTab === 'history' ? (
                <div className="space-y-8">
                    {/* 1. Hero Card: Today's Action */}
                    <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex items-start gap-4">
                                <div className="p-4 rounded-full bg-blue-500/10">
                                    <Clock className="h-8 w-8 text-blue-500" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-foreground">Bugünün Sayımı</h3>
                                    <p className="text-muted-foreground mt-1">
                                        {format(new Date(), 'dd MMMM yyyy', { locale: tr })} tarihi için işlem yapın.
                                    </p>
                                    <div className="mt-2 text-sm">
                                        {todayStatus === 'LOADING' ? (
                                            <span className="text-muted-foreground">Yükleniyor...</span>
                                        ) : todayStatus === 'EXISTS' ? (
                                            <span className="text-emerald-600 font-medium flex items-center gap-1">
                                                <CheckCircle className="h-4 w-4" /> Oturum Mevcut ({todaySessionData?.status === 'COMPLETED' ? 'Tamamlandı' : 'Devam Ediyor'})
                                            </span>
                                        ) : (
                                            <span className="text-amber-600 font-medium flex items-center gap-1">
                                                <AlertTriangle className="h-4 w-4" /> Henüz oturum açılmamış
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                {todayStatus === 'NONE' && (
                                    <button
                                        onClick={startSession}
                                        disabled={loading}
                                        className="flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50"
                                    >
                                        <PlayCircle className="h-5 w-5" />
                                        Sayımı Başlat
                                    </button>
                                )}
                                {todayStatus === 'EXISTS' && (
                                    <>
                                        <button
                                            onClick={() => {
                                                setCountDate(format(new Date(), 'yyyy-MM-dd'));
                                                setActiveTab('active');
                                            }}
                                            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20"
                                        >
                                            <div className="relative">
                                                <RotateCcw className="h-5 w-5" />
                                                {todaySessionData?.status !== 'COMPLETED' && <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span></span>}
                                            </div>
                                            {todaySessionData?.status === 'COMPLETED' ? 'Sonuçları Görüntüle' : 'Sayımı Sürdür'}
                                        </button>
                                        {todaySessionData?.status !== 'COMPLETED' && (
                                            <button
                                                onClick={() => {
                                                    const today = format(new Date(), 'yyyy-MM-dd');
                                                    fetch(`/api/stock-count/session?date=${today}`)
                                                        .then(res => res.json())
                                                        .then(data => {
                                                            if (data?.id) {
                                                                setSessionId(data.id);
                                                                setEndSessionModal({ isOpen: true, sessionId: data.id });
                                                            }
                                                        });
                                                }}
                                                disabled={loading}
                                                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20 disabled:opacity-50"
                                            >
                                                <CheckCircle className="h-5 w-5" />
                                                Sayımı Bitir
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 2. Past Sessions List */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-foreground px-1">Geçmiş Sayımlar</h3>
                        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground border-b border-border">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">Tarih</th>
                                        <th className="px-6 py-4 font-medium">Kullanıcı</th>
                                        <th className="px-6 py-4 font-medium text-center">Toplam Kalem</th>
                                        <th className="px-6 py-4 font-medium text-center">Farklı Kalem</th>
                                        <th className="px-6 py-4 font-medium text-center">Durum</th>
                                        <th className="px-6 py-4 font-medium text-right">İşlem</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {loading && historySessions.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                                <RotateCcw className="h-6 w-6 animate-spin mx-auto mb-2" />
                                                Geçmiş yükleniyor...
                                            </td>
                                        </tr>
                                    ) : historySessions.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                                Henüz tamamlanmış bir sayım kaydı yok.
                                            </td>
                                        </tr>
                                    ) : (
                                        historySessions.map((session) => (
                                            <tr key={session.id} className="hover:bg-muted/50 transition-colors">
                                                <td className="px-6 py-4 font-medium">{format(new Date(session.date), 'dd MMMM yyyy', { locale: tr })}</td>
                                                <td className="px-6 py-4 text-muted-foreground">{session.user}</td>
                                                <td className="px-6 py-4 text-center font-mono">{session.totalItems}</td>
                                                <td className="px-6 py-4 text-center font-mono font-bold">
                                                    {session.mismatchCount > 0 ? (
                                                        <span className="text-red-600">{session.mismatchCount}</span>
                                                    ) : (
                                                        <span className="text-emerald-600">0</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {(() => {
                                                        const sessionDate = new Date(session.date);
                                                        const today = new Date();
                                                        today.setHours(0, 0, 0, 0);
                                                        sessionDate.setHours(0, 0, 0, 0);
                                                        const isPastDay = sessionDate < today;
                                                        const isIncomplete = session.status !== 'COMPLETED' && isPastDay;

                                                        return (
                                                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${session.status === 'COMPLETED'
                                                                    ? 'bg-blue-500/10 text-blue-600'
                                                                    : isIncomplete
                                                                        ? 'bg-red-500/10 text-red-600'
                                                                        : 'bg-amber-500/10 text-amber-600'
                                                                }`}>
                                                                {session.status === 'COMPLETED'
                                                                    ? 'Tamamlandı'
                                                                    : isIncomplete
                                                                        ? 'Yarım Kaldı'
                                                                        : 'Devam Ediyor'}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => handleHistoryClick(session.date)}
                                                        className="text-blue-600 hover:underline text-xs flex items-center justify-end gap-1 ml-auto"
                                                    >
                                                        Detay Gör <Search className="h-3 w-3" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                /* ACTIVE SESSION VIEW (Counting UI) */
                <>
                    {/* Session Status Bar (Instead of Starter) */}
                    {sessionStatus === 'NOT_STARTED' && (
                        <div className="flex items-center justify-center p-8 bg-card border border-border rounded-xl">
                            <p className="text-muted-foreground">Oturum verisi bulunamadı. Lütfen geri dönüp tekrar deneyin.</p>
                        </div>
                    )}

                    {/* Active Session UI */}
                    {sessionStatus === 'ACTIVE' && (
                        <>
                            {/* Stats Cards - Same as before */}
                            {!blindMode ? (
                                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
                                    <div className="col-span-2 lg:col-span-1 rounded-xl border border-border bg-card p-4">
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
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="rounded-xl border border-border bg-card p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-blue-500/10">
                                                <Package className="h-5 w-5 text-blue-500" />
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                                                <p className="text-xs text-muted-foreground">Toplam Kalem</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-border bg-card p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-purple-500/10">
                                                <CheckCircle className="h-5 w-5 text-purple-500" />
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold text-foreground">{items.length - stats.pending}</p>
                                                <p className="text-xs text-muted-foreground">Sayılan Kalem</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

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
                            </div>

                            {/* Filter & Export */}
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

                            {/* Table */}
                            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground border-b border-border">
                                            <tr>
                                                <th className="px-6 py-4 font-medium">Malzeme</th>
                                                <th className="px-6 py-4 font-medium">Firma</th>
                                                <th className="px-6 py-4 font-medium">Konum</th>
                                                {!blindMode && <th className="px-6 py-4 font-medium text-right">Sistem Stoğu</th>}
                                                <th className="px-6 py-4 font-medium text-right w-40">Sayım Sonucu</th>
                                                {!blindMode && <th className="px-6 py-4 font-medium text-center w-32">Fark</th>}
                                                {!blindMode && <th className="px-6 py-4 font-medium w-32">Durum</th>}
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
                                                        className={`hover:bg-muted/50 transition-colors ${!blindMode && item.status === 'MISMATCH' ? 'bg-red-500/5' :
                                                            !blindMode && item.status === 'MATCH' ? 'bg-emerald-500/5' : ''
                                                            }`}
                                                    >
                                                        <td className="px-6 py-4 font-medium">
                                                            <div className="flex flex-col">
                                                                <span className="font-mono flex items-center gap-2">
                                                                    {item.materialReference}
                                                                    {item.material?.abcClass && (
                                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${item.material.abcClass === 'A' ? 'bg-green-100 text-green-700 border-green-200' :
                                                                            item.material.abcClass === 'B' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                                                'bg-slate-100 text-slate-700 border-slate-200'
                                                                            }`}>
                                                                            {item.material.abcClass}
                                                                        </span>
                                                                    )}
                                                                </span>
                                                                {item.material?.description && (
                                                                    <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={item.material.description}>
                                                                        {item.material.description}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-muted-foreground">{item.company || '-'}</td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span>{item.location || '-'}</span>
                                                                {item.material?.defaultLocation && item.material.defaultLocation !== item.location && (
                                                                    <span className="text-xs text-amber-600/80" title="Varsayılan Konum">
                                                                        (Var: {item.material.defaultLocation})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        {!blindMode && (
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    {item.material?.minStock && item.systemStock <= item.material.minStock && (
                                                                        <div className="group relative" title={`Kritik Stok! (Min: ${item.material.minStock})`}>
                                                                            <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" />
                                                                        </div>
                                                                    )}
                                                                    <span className="font-mono text-lg font-bold">{item.systemStock}</span>
                                                                    {item.material?.unit && (
                                                                        <span className="text-xs text-muted-foreground self-end mb-1">{item.material.unit}</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        )}
                                                        <td className="px-6 py-4">
                                                            <div className="relative">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={item.countedStock}
                                                                    onChange={(e) => handleCountChange(item.id, e.target.value)}
                                                                    className={`w-full text-right rounded-md border px-3 py-1.5 focus:outline-none font-bold font-mono pl-8 ${!blindMode && item.status === 'MATCH' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700' :
                                                                        !blindMode && item.status === 'MISMATCH' ? 'border-red-500 bg-red-500/10 text-red-700' :
                                                                            'border-input bg-background'
                                                                        }`}
                                                                    placeholder="0"
                                                                />
                                                                {item.saved && (
                                                                    <Cloud className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-emerald-500" />
                                                                )}
                                                                {savingItem === item.id && (
                                                                    <RotateCcw className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-blue-500" />
                                                                )}
                                                            </div>
                                                        </td>
                                                        {!blindMode && (
                                                            <td className="px-6 py-4 text-center font-mono font-bold">
                                                                {item.status === 'MISMATCH' && (
                                                                    <span className={item.difference! > 0 ? 'text-emerald-600' : 'text-red-600'}>
                                                                        {item.difference! > 0 ? '+' : ''}{item.difference}
                                                                    </span>
                                                                )}
                                                                {item.status === 'MATCH' && <span className="text-emerald-600">0</span>}
                                                                {item.status === 'PENDING' && <span className="text-muted-foreground">-</span>}
                                                            </td>
                                                        )}
                                                        {!blindMode && (
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
                                                        )}
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
                        </>
                    )}
                </>
            )}
            {/* End Session Confirm Modal */}
            <ConfirmModal
                isOpen={endSessionModal.isOpen}
                onClose={() => setEndSessionModal({ isOpen: false, sessionId: null })}
                onConfirm={handleConfirmEndSession}
                title="Sayımı Bitir"
                description="Sayımı bitirmek istediğinize emin misiniz? Bu işlem geri alınamaz ve sonuçlar kesinleşecektir."
                confirmText="Bitir"
                variant="danger"
            />
        </div>
    );
}
