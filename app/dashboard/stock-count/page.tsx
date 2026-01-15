'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/components/language-provider';
import { useToast } from '@/components/toast';
import { Search, Save, RotateCcw, CheckCircle } from 'lucide-react';

interface StockCountItem {
    id: string;
    materialReference: string;
    company: string;
    location?: string;
    systemStock: number;
    countedStock: number | '';
    status: 'PENDING' | 'MATCH' | 'MISMATCH';
}

export default function StockCountPage() {
    const { t } = useLanguage();
    const { showToast } = useToast();
    const { data: session } = useSession();
    const [items, setItems] = useState<StockCountItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Mock data loader - will be replaced with API call
    const loadInventory = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/inventory?limit=100'); // Fetch active items
            if (res.ok) {
                const data = await res.json();
                const inventory = data.data?.items || [];

                // Group by material reference for counting? 
                // Or list individual items? 
                // Ideally stock counting is done per "Material Reference" total.
                // Let's aggregate locally for this view since API returns items.

                const aggregated = new Map<string, StockCountItem>();

                inventory.forEach((item: any) => {
                    if (!aggregated.has(item.materialReference)) {
                        aggregated.set(item.materialReference, {
                            id: item.materialReference, // Use ref as ID for grouping
                            materialReference: item.materialReference,
                            company: item.company, // Valid assumption?
                            location: item.location,
                            systemStock: 0,
                            countedStock: '',
                            status: 'PENDING'
                        });
                    }
                    const current = aggregated.get(item.materialReference)!;
                    if (item.lastAction === 'Giriş') current.systemStock += item.stockCount;
                    else if (item.lastAction === 'Çıkış') current.systemStock -= item.stockCount;
                });

                setItems(Array.from(aggregated.values()));
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
                const status = value === '' ? 'PENDING' : (numValue === item.systemStock ? 'MATCH' : 'MISMATCH');
                return { ...item, countedStock: value === '' ? '' : numValue, status };
            }
            return item;
        }));
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Stok Sayım Modülü</h2>
                    <p className="text-muted-foreground">Fiziksel sayım ve sistem karşılaştırması</p>
                </div>
                <button
                    onClick={loadInventory}
                    className="flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                    <RotateCcw className="h-4 w-4" />
                    Listeyi Yenile
                </button>
            </div>

            {/* Filter / Search */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Malzeme Referansı veya Konum Ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none"
                    />
                </div>
            </div>

            {/* Counting Table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground border-b border-border">
                        <tr>
                            <th className="px-6 py-4 font-medium">Malzeme</th>
                            <th className="px-6 py-4 font-medium">Konum</th>
                            <th className="px-6 py-4 font-medium text-right">Sistem Stoğu</th>
                            <th className="px-6 py-4 font-medium text-right w-48">Sayım Sonucu</th>
                            <th className="px-6 py-4 font-medium w-32">Durum</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {items
                            .filter(i => i.materialReference.includes(searchTerm.toUpperCase()) || (i.location && i.location.includes(searchTerm.toUpperCase())))
                            .map(item => (
                                <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                                    <td className="px-6 py-4 font-medium">{item.materialReference}</td>
                                    <td className="px-6 py-4 text-muted-foreground">{item.location || '-'}</td>
                                    <td className="px-6 py-4 text-right font-mono text-lg">{item.systemStock}</td>
                                    <td className="px-6 py-4">
                                        <input
                                            type="number"
                                            value={item.countedStock}
                                            onChange={(e) => handleCountChange(item.id, e.target.value)}
                                            className="w-full text-right rounded-md border border-input bg-background px-3 py-1.5 focus:border-blue-500 focus:outline-none font-bold"
                                        />
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {item.status === 'MATCH' && <span className="inline-flex items-center text-emerald-600 font-bold"><CheckCircle className="h-4 w-4 mr-1" /> Eşleşti</span>}
                                        {item.status === 'MISMATCH' && <span className="text-red-600 font-bold">Fark: {typeof item.countedStock === 'number' ? item.countedStock - item.systemStock : ''}</span>}
                                        {item.status === 'PENDING' && <span className="text-muted-foreground">-</span>}
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
