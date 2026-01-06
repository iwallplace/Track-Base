'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useToast } from '@/components/toast';

interface AddItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    mode: 'Giriş' | 'Çıkış';
    initialData?: {
        company?: string;
        waybillNo?: string;
        materialReference?: string;
        note?: string;
    } | null;
}

export default function AddItemModal({ isOpen, onClose, onSuccess, mode, initialData }: AddItemModalProps) {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<{
        company: string;
        waybillNo: string;
        materialReference: string;
        stockCount: number | '';
        lastAction: 'Giriş' | 'Çıkış';
        note: string;
    }>({
        company: '',
        waybillNo: '',
        materialReference: '',
        stockCount: '',
        lastAction: mode,
        note: ''
    });

    // Reset/Update form when mode changes or modal opens
    useEffect(() => {
        if (isOpen) {
            setFormData({
                company: initialData?.company || '',
                waybillNo: initialData?.waybillNo || '',
                materialReference: initialData?.materialReference || '',
                stockCount: '', // Always reset stock count for safety
                lastAction: mode,
                note: initialData?.note || ''
            });
        }
    }, [isOpen, mode, initialData]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Manual validation for strictness
        // Note: Uppercase conversion and trim are handled by Backend Zod Schema now.
        // We send data as is, CSS handles visual uppercase.

        const stockVal = typeof formData.stockCount === 'number' ? formData.stockCount : 0;
        if (!formData.materialReference || !formData.waybillNo || stockVal <= 0) {
            showToast("Lütfen zorunlu alanları doldurunuz (Referans, İrsaliye, Stok)", 'error');
            return;
        }

        // Tam sayı kontrolü
        if (!Number.isInteger(stockVal)) {
            showToast("Stok adedi tam sayı olmalıdır (ondalıklı değer girilemez)", 'error');
            return;
        }

        if (mode === 'Giriş' && !formData.company) {
            showToast("Lütfen firma adını giriniz", 'error');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/inventory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                onSuccess();
                onClose();
                // Reset form
                setFormData({ ...formData, waybillNo: '', materialReference: '', stockCount: '', note: '' });
                showToast("İşlem başarıyla kaydedildi", 'success');
            } else {
                // API'den gelen hata mesajını göster
                const data = await res.json();
                showToast(data.error || 'Hata oluştu.', 'error');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in duration-200">
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-foreground">
                        {mode === 'Giriş' ? 'Yeni Giriş Ekle' : 'Yeni Çıkış Ekle'}
                    </h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {mode === 'Giriş' && (
                            <div>
                                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                                    Firma <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required={mode === 'Giriş'}
                                    placeholder="Örn: ABC Otomotiv"
                                    value={formData.company}
                                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                    className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:border-blue-500 focus:outline-none uppercase"
                                />
                            </div>
                        )}
                        <div>
                            <label className="mb-1 block text-sm font-medium text-muted-foreground">
                                İrsaliye No <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="IRS-2024-..."
                                value={formData.waybillNo}
                                onChange={(e) => setFormData({ ...formData, waybillNo: e.target.value })}
                                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:border-blue-500 focus:outline-none uppercase"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-muted-foreground">
                                Malzeme Referans <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="REF-..."
                                value={formData.materialReference}
                                onChange={(e) => setFormData({ ...formData, materialReference: e.target.value })}
                                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:border-blue-500 focus:outline-none uppercase"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-muted-foreground">
                                Stok Adedi <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                min="1"
                                step="1"
                                required
                                placeholder="Adet giriniz"
                                value={formData.stockCount}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    // Boş değer kontrolü (sıfıra zorlamayı engelle)
                                    if (val === '') {
                                        setFormData({ ...formData, stockCount: '' });
                                        return;
                                    }

                                    // Sadece tam sayı değerleri kabul et
                                    const intVal = parseInt(val);
                                    if (!isNaN(intVal)) {
                                        setFormData({ ...formData, stockCount: intVal });
                                    }
                                }}
                                onKeyDown={(e) => {
                                    // Nokta ve virgül girişini engelle
                                    if (e.key === '.' || e.key === ',') {
                                        e.preventDefault();
                                    }
                                }}
                                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {/* Last Action is hidden as it is determined by mode */}
                        <input type="hidden" value={mode} />
                        <div>
                            <label className="mb-1 block text-sm font-medium text-muted-foreground">Not</label>
                            <input
                                type="text"
                                placeholder="Varsa notunuz..."
                                value={formData.note}
                                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:border-blue-500 focus:outline-none uppercase"
                            />
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg px-4 py-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                            İptal
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {loading ? 'Kaydediliyor...' : 'Kaydet'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
