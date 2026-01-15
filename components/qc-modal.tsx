'use client';

import { useState } from 'react';
import { X, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/components/toast';

interface QCModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    item: {
        id: string;
        materialReference: string;
        qcStatus: string | null;
        qcNote: string | null;
    } | null;
}

export default function QCModal({ isOpen, onClose, onSuccess, item }: QCModalProps) {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [note, setNote] = useState('');

    if (!isOpen || !item) return null;

    const handleAction = async (status: 'APPROVED' | 'REJECTED') => {
        setLoading(true);
        try {
            const res = await fetch('/api/inventory', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: item.id,
                    action: 'qc_update',
                    qcStatus: status,
                    qcNote: note
                })
            });

            if (res.ok) {
                showToast(`Kalite kontrol durumu güncellendi: ${status === 'APPROVED' ? 'Onaylandı' : 'Reddedildi'}`, 'success');
                onSuccess();
                onClose();
                setNote('');
            } else {
                showToast('Güncelleme başarısız oldu', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Bir hata oluştu', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in duration-200">
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-foreground">Kalite Kontrol İşlemi</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="mb-6 space-y-2">
                    <p className="text-sm text-muted-foreground">Malzeme:</p>
                    <p className="font-medium text-foreground text-lg">{item.materialReference}</p>
                    <p className="text-sm text-muted-foreground">Mevcut Durum: <span className="font-medium text-foreground">{item.qcStatus || 'Bilinmiyor'}</span></p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-muted-foreground">Kontrol Notu (Opsiyonel)</label>
                        <textarea
                            rows={3}
                            placeholder="Red veya onay gerekçesi..."
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:border-blue-500 focus:outline-none resize-none"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={() => handleAction('REJECTED')}
                            disabled={loading}
                            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-100 px-4 py-2.5 font-medium text-red-700 hover:bg-red-200 disabled:opacity-50 transition-colors"
                        >
                            <XCircle className="h-5 w-5" />
                            Reddet
                        </button>
                        <button
                            onClick={() => handleAction('APPROVED')}
                            disabled={loading}
                            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-100 px-4 py-2.5 font-medium text-emerald-700 hover:bg-emerald-200 disabled:opacity-50 transition-colors"
                        >
                            <CheckCircle className="h-5 w-5" />
                            Onayla
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
