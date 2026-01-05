'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { Download, Mail, Bot, FileSpreadsheet, AlertTriangle, Package, Server, Database, Cpu, Activity } from 'lucide-react';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import * as XLSX from 'xlsx';

interface ReportsViewProps {
    data: {
        statusCounts: any[];
        monthlyActivity: any[];
        totalStock: number;
        uniqueMaterialCount: number;
        turnoverRate: string;
        deadStockCount: number;
        lowStockCount: number;
        lowStockItems: { id: string; materialReference: string; company: string; stockCount: number }[];
        topMaterials: { reference: string; transactionCount: number; totalStock: number }[];
        systemMetrics?: {
            dbSize: string;
            memoryUsage: string;
            uptime: number;
            platform: string;
            rowCount: number;
        };
    };
    period: string; // Used for export filename and display
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function ReportsView({ data, period }: ReportsViewProps) {
    const router = useRouter();
    const reportRef = useRef<HTMLDivElement>(null);

    const [summary, setSummary] = useState<string | null>(null);
    const [generatingSummary, setGeneratingSummary] = useState(false);
    const hasFetched = useRef(false);

    useEffect(() => {
        if (!hasFetched.current) {
            hasFetched.current = true;
            handleGenerateSummary();
        }
    }, []);

    const handleDownloadPDF = async () => {
        const pdfTemplate = document.getElementById('pdf-report-template');
        if (!pdfTemplate) {
            alert("PDF şablonu bulunamadı.");
            return;
        }

        const btn = document.getElementById('download-pdf-btn');
        if (btn) btn.innerText = "Hazırlanıyor...";

        try {
            const originalStyle = pdfTemplate.style.cssText;
            pdfTemplate.style.cssText = `
                position: fixed;
                left: 0;
                top: 0;
                z-index: 9999;
                width: 800px;
                min-height: 1130px;
                background-color: #ffffff;
                color: #1f2937;
                font-family: system-ui, -apple-system, sans-serif;
                padding: 48px;
                box-sizing: border-box;
            `;

            await new Promise(resolve => setTimeout(resolve, 500));

            const dataUrl = await toPng(pdfTemplate, {
                backgroundColor: '#ffffff',
                pixelRatio: 2,
                width: 800,
                height: 1130
            });

            pdfTemplate.style.cssText = originalStyle;

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`KPI-Rapor-${period.replace(/\s/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);

            if (btn) btn.innerHTML = '<Download class="h-4 w-4" /> PDF İndir';
        } catch (error) {
            console.error(error);
            const pdfTemplate = document.getElementById('pdf-report-template');
            if (pdfTemplate) pdfTemplate.style.left = '-9999px';
            alert("PDF oluşturulamadı: " + (error as any).message);
            if (btn) btn.innerHTML = '<Download class="h-4 w-4" /> PDF İndir';
        }
    };

    const handleGenerateSummary = async () => {
        setGeneratingSummary(true);
        try {
            const res = await fetch('/api/ai/generate-summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportData: data })
            });

            const result = await res.json();
            if (res.ok && result.text) {
                setSummary(result.text);
            } else {
                if (process.env.NODE_ENV === 'development' && res.status !== 429) {
                    console.warn("AI Summary unavailable");
                }
            }
        } catch (e) {
            // Silent fail
        } finally {
            setGeneratingSummary(false);
        }
    };



    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();

        // Sheet 1: Summary
        const summaryData = [
            ['Metrik', 'Değer'],
            ['Toplam Malzeme Ref', data.uniqueMaterialCount],
            ['Toplam Stok Adedi', data.totalStock],
            ['Stok Devir Hızı', `%${data.turnoverRate}`],
            ['Ölü Stok', data.deadStockCount],
            ['Kritik Seviye', data.lowStockCount],
        ];
        const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, ws1, 'Özet');

        // Sheet 2: Status Counts
        const statusData = [['Durum', 'Adet'], ...data.statusCounts.map(s => [s.name, s.value])];
        const ws2 = XLSX.utils.aoa_to_sheet(statusData);
        XLSX.utils.book_append_sheet(wb, ws2, 'İşlem Durumları');

        XLSX.writeFile(wb, `Rapor-${period.replace(/\s/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="space-y-6">
            {/* Header without DateRangePicker */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Raporlar</h2>
                    <p className="text-muted-foreground">Genel bakış ve performans analizleri</p>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 flex-wrap">
                <button
                    onClick={handleGenerateSummary}
                    disabled={generatingSummary}
                    className="flex items-center gap-2 rounded-lg border border-purple-500/50 bg-purple-500/10 px-4 py-2 text-sm font-medium text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 transition-colors"
                >
                    <Bot className={`h-4 w-4 ${generatingSummary ? 'animate-pulse' : ''}`} />
                    {generatingSummary ? 'Analiz Ediliyor...' : 'Yönetici Özeti (AI)'}
                </button>

                <button
                    id="download-pdf-btn"
                    onClick={handleDownloadPDF}
                    className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
                >
                    <Download className="h-4 w-4" />
                    PDF İndir
                </button>
            </div>

            {/* AI Summary Section */}
            {summary && (
                <div className="rounded-xl border border-border bg-muted/30 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Bot className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-semibold text-foreground">Yönetici Özeti (AI Analizi)</h3>
                    </div>
                    <div className="text-sm text-foreground whitespace-pre-line leading-relaxed font-medium">
                        {summary}
                    </div>
                </div>
            )}

            {/* Dashboard Content */}
            <div ref={reportRef} className="space-y-6 bg-background p-4 rounded-xl">
                {/* KPI Cards */}
                <div className="grid gap-4 md:grid-cols-4 mb-6">
                    <div className="rounded-xl border border-border bg-card p-4 text-center shadow-sm">
                        <div className="text-xs uppercase text-muted-foreground font-bold tracking-wider">TOPLAM MALZEME</div>
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{data.uniqueMaterialCount?.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground mt-1">Farklı Referans</div>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4 text-center shadow-sm">
                        <div className="text-xs uppercase text-muted-foreground font-bold tracking-wider">Stok Devir Hızı</div>
                        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">%{data.turnoverRate}</div>
                        <div className="text-xs text-emerald-600/70 dark:text-emerald-500/70 mt-1">Satış Dönüşüm</div>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4 text-center shadow-sm">
                        <div className="text-xs uppercase text-muted-foreground font-bold tracking-wider">Ölü Stok (90+ Gün)</div>
                        <div className={`text-2xl font-bold mt-1 ${data.deadStockCount > 0 ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'}`}>
                            {data.deadStockCount}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Kalem Ürün</div>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4 text-center shadow-sm">
                        <div className="text-xs uppercase text-muted-foreground font-bold tracking-wider">Kritik Seviye</div>
                        <div className={`text-2xl font-bold mt-1 ${data.lowStockCount > 0 ? 'text-amber-500 dark:text-amber-400' : 'text-muted-foreground'}`}>
                            {data.lowStockCount}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Low Stock</div>
                    </div>
                </div>

                {/* Charts Area - Status & Monthly Activity */}
                <div className="grid gap-6 md:grid-cols-2 mb-6">
                    {/* Status Breakdown */}
                    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                        <h3 className="mb-6 text-lg font-medium text-foreground">İşlem Durumu Dağılımı</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data.statusCounts}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={70}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {data.statusCounts.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        contentStyle={{ backgroundColor: 'var(--color-popover)', borderColor: 'var(--color-border)', borderRadius: '0.5rem', color: 'var(--color-popover-foreground)' }}
                                        itemStyle={{ color: 'var(--color-popover-foreground)' }}
                                    />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Monthly Activity Area Chart */}
                    {data.monthlyActivity && data.monthlyActivity.length > 0 ? (
                        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                            <h3 className="mb-6 text-lg font-medium text-foreground">Dönemsel İşlem Hacmi</h3>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data.monthlyActivity}>
                                        <defs>
                                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.1} />
                                                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                                        <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                                        <RechartsTooltip
                                            contentStyle={{ backgroundColor: 'var(--color-popover)', borderColor: 'var(--color-border)', borderRadius: '0.5rem', color: 'var(--color-popover-foreground)' }}
                                            itemStyle={{ color: 'var(--color-popover-foreground)' }}
                                        />
                                        <Area type="monotone" dataKey="entry" stroke="#10B981" fillOpacity={1} fill="url(#colorValue)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-border bg-card p-6 flex items-center justify-center text-muted-foreground shadow-sm">
                            Veri bulunamadı
                        </div>
                    )}
                </div>

                {/* Bottom Lists: Stock Alerts & Top Materials */}
                <div className="grid gap-6 md:grid-cols-2 mt-6">
                    {/* Stock Alerts */}
                    <div className="rounded-xl border border-amber-500/30 bg-card p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            <h3 className="text-lg font-medium text-amber-600 dark:text-amber-400">Kritik Stok Uyarıları</h3>
                        </div>
                        {data.lowStockItems?.length > 0 ? (
                            <div className="space-y-3">
                                {data.lowStockItems.map(item => (
                                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                        <div>
                                            <div className="text-foreground font-medium">{item.materialReference}</div>
                                            <div className="text-xs text-muted-foreground">{item.company}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-amber-600 dark:text-amber-400 font-bold">{item.stockCount} adet</div>
                                            <div className="text-xs text-amber-600 dark:text-amber-500">Kritik!</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>Kritik stok seviyesinde ürün yok</p>
                            </div>
                        )}
                    </div>

                    {/* Top Materials */}
                    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <Package className="h-5 w-5 text-blue-500" />
                            <h3 className="text-lg font-medium text-foreground">En Hareketli Ürünler</h3>
                        </div>
                        {data.topMaterials && data.topMaterials.length > 0 ? (
                            <div className="space-y-3">
                                {data.topMaterials.map((material, index) => (
                                    <div key={material.reference} className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-500">
                                                {index + 1}
                                            </div>
                                            <span className="text-foreground font-mono text-sm">{material.reference}</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-foreground font-bold">{material.transactionCount} işlem</div>
                                            <div className="text-xs text-muted-foreground">{material.totalStock.toLocaleString()} adet</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>Bu dönemde hareketli ürün yok</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* System Metrics Section (Admin Only - Data Dependent) */}
            {data.systemMetrics && (
                <div className="rounded-xl border border-indigo-500/30 bg-card p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <Activity className="h-5 w-5 text-indigo-500" />
                        <h3 className="text-lg font-medium text-foreground">Sistem Durumu (Admin Panel)</h3>
                    </div>
                    <div className="grid gap-4 md:grid-cols-4">
                        <div className="flex items-center gap-4 rounded-lg bg-indigo-500/10 p-4 border border-indigo-500/20">
                            <div className="p-2 rounded-full bg-indigo-500/20 text-indigo-500">
                                <Database className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground uppercase font-bold">DB Boyutu</div>
                                <div className="text-lg font-bold text-foreground">{data.systemMetrics.dbSize}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 rounded-lg bg-indigo-500/10 p-4 border border-indigo-500/20">
                            <div className="p-2 rounded-full bg-indigo-500/20 text-indigo-500">
                                <Cpu className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground uppercase font-bold">RAM Kullanımı</div>
                                <div className="text-lg font-bold text-foreground">{data.systemMetrics.memoryUsage}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 rounded-lg bg-indigo-500/10 p-4 border border-indigo-500/20">
                            <div className="p-2 rounded-full bg-indigo-500/20 text-indigo-500">
                                <Server className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground uppercase font-bold">Platform</div>
                                <div className="text-lg font-bold text-foreground">{data.systemMetrics.platform}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 rounded-lg bg-indigo-500/10 p-4 border border-indigo-500/20">
                            <div className="p-2 rounded-full bg-indigo-500/20 text-indigo-500">
                                <Activity className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground uppercase font-bold">Toplam Kayıt</div>
                                <div className="text-lg font-bold text-foreground">{data.systemMetrics.rowCount.toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}



            {/* Hidden PDF Template */}
            <div
                id="pdf-report-template"
                style={{
                    position: 'absolute',
                    left: '-9999px',
                    top: 0,
                    width: '800px',
                    minHeight: '1130px',
                    backgroundColor: '#ffffff',
                    color: '#1f2937',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    padding: '48px',
                    boxSizing: 'border-box'
                }}
            >
                {/* PDF Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #2563eb', paddingBottom: '20px', marginBottom: '32px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <div style={{ width: '40px', height: '40px', backgroundColor: '#2563eb', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '20px' }}>P</div>
                            <div>
                                <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>Project Track Base</h1>
                                <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Stok Yönetimi ve Performans Raporu</p>
                            </div>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#111827' }}>{new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Dönem: {period}</p>
                    </div>
                </div>

                {/* KPI Scorecard */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
                    <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: '#1e40af', fontWeight: 'bold' }}>TOPLAM MALZEME</div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1d4ed8' }}>{data.uniqueMaterialCount?.toLocaleString()}</div>
                    </div>
                    <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: '#065f46', fontWeight: 'bold' }}>DEVİR HIZI</div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#059669' }}>%{data.turnoverRate}</div>
                    </div>
                    <div style={{ backgroundColor: data.deadStockCount > 0 ? '#fef2f2' : '#f9fafb', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: '#991b1b', fontWeight: 'bold' }}>ÖLÜ STOK</div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: data.deadStockCount > 0 ? '#dc2626' : '#6b7280' }}>{data.deadStockCount}</div>
                    </div>
                    <div style={{ backgroundColor: data.lowStockCount > 0 ? '#fffbeb' : '#f9fafb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: '#92400e', fontWeight: 'bold' }}>KRİTİK SEVİYE</div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: data.lowStockCount > 0 ? '#d97706' : '#6b7280' }}>{data.lowStockCount}</div>
                    </div>
                </div>

                {/* AI Summary */}
                {summary && (
                    <div style={{ marginBottom: '32px', padding: '20px', backgroundColor: '#f0f9ff', borderLeft: '4px solid #0284c7', borderRadius: '0 8px 8px 0' }}>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold', color: '#0c4a6e' }}>🤖 Yönetici Özeti</h3>
                        <p style={{ margin: 0, fontSize: '12px', lineHeight: '1.6', color: '#334155', whiteSpace: 'pre-line' }}>{summary}</p>
                    </div>
                )}

                {/* Charts */}
                <div style={{ marginBottom: '32px' }}>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', backgroundColor: '#fafafa', width: '50%', margin: '0 auto' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: 'bold', color: '#374151', textAlign: 'center' }}>İşlem Durumu</h4>
                        <div style={{ height: '180px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={data.statusCounts} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value">
                                        {data.statusCounts.map((entry, index) => (
                                            <Cell key={`pdf-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Legend iconSize={8} wrapperStyle={{ fontSize: '9px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ position: 'absolute', bottom: '32px', left: '48px', right: '48px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#9ca3af', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                    <span>© 2026 Project Track Base - Tüm Hakları Saklıdır</span>
                    <span>Sayfa 1 / 1</span>
                </div>
            </div>
        </div>
    );
}
