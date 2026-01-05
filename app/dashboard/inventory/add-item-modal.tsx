'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface AddItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    mode: 'Giriş' | 'Çıkış';
}

export default function AddItemModal({ isOpen, onClose, onSuccess, mode }: AddItemModalProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        company: '',
        waybillNo: '',
        materialReference: '',
        stockCount: 0,
        lastAction: mode,
        note: ''
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Manual validation for strictness
        if (!formData.materialReference || !formData.waybillNo || formData.stockCount <= 0) {
            alert("Lütfen zorunlu alanları doldurunuz (Referans, İrsaliye, Stok)");
            return;
        }

        if (mode === 'Giriş' && !formData.company) {
            alert("Lütfen firma adını giriniz");
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
                setFormData({ ...formData, waybillNo: '', materialReference: '', stockCount: 0, note: '' });
            } else {
                alert('Hata oluştu.');
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
                                    className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:border-blue-500 focus:outline-none"
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
                                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:border-blue-500 focus:outline-none"
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
                                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-muted-foreground">
                                Stok Adedi <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                min="1"
                                required
                                value={formData.stockCount}
                                onChange={(e) => setFormData({ ...formData, stockCount: parseInt(e.target.value) || 0 })}
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
                                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:border-blue-500 focus:outline-none"
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
