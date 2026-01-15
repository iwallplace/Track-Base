'use client';

import { useState, useEffect } from 'react';
import { X, Search, Save, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/toast';

interface Material {
    id: string;
    reference: string;
    minStock: number;
    description?: string;
}

interface MaterialSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function MaterialSettingsModal({ isOpen, onClose }: MaterialSettingsModalProps) {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch existing definitions
    const fetchMaterials = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/materials?search=${searchTerm}`);
            if (res.ok) {
                const data = await res.json();
                setMaterials(data.data || []);
            }
        } catch (error) {
            console.error(error);
            showToast('Malzemeler yüklenemedi', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchMaterials();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, searchTerm]);

    const handleUpdate = async (reference: string, minStock: number, description?: string) => {
        try {
            const res = await fetch('/api/materials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reference, minStock, description })
            });

            if (res.ok) {
                showToast('Güncellendi', 'success');
                // Refresh local list if needed, or just keep state optimistically
            } else {
                showToast('Güncelleme başarısız', 'error');
            }
        } catch (error) {
            console.error(error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-xl flex flex-col max-h-[80vh]">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Malzeme Limit Ayarları</h2>
                        <p className="text-sm text-muted-foreground">Her malzeme için kritik stok seviyesini belirleyin.</p>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="flex gap-4 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Malzeme Referansı Ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto border rounded-xl">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground sticky top-0 backdrop-blur-md">
                            <tr>
                                <th className="px-4 py-3">Referans</th>
                                <th className="px-4 py-3 w-32">Kritik Limit</th>
                                <th className="px-4 py-3">Açıklama</th>
                                <th className="px-4 py-3 w-20"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {materials.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                                        Kayıt bulunamadı. Veritabanına yeni malzeme eklendikçe burada görünecektir.
                                        <br />
                                        <span className="text-xs italic">(Henüz veritabanında "Material" kaydı yoksa, stok hareketlerinden otomatik oluşturulmaz. Manuel eklemelisiniz.)</span>
                                    </td>
                                </tr>
                            )}
                            {materials.map((m) => (
                                <MaterialRow key={m.id || m.reference} material={m} onUpdate={handleUpdate} />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function MaterialRow({ material, onUpdate }: { material: Material, onUpdate: (ref: string, limit: number, desc?: string) => void }) {
    const [limit, setLimit] = useState(material.minStock);
    const [desc, setDesc] = useState(material.description || '');
    const [isDirty, setIsDirty] = useState(false);

    return (
        <tr className="hover:bg-muted/50 group">
            <td className="px-4 py-3 font-medium">{material.reference}</td>
            <td className="px-4 py-3">
                <input
                    type="number"
                    value={limit}
                    onChange={(e) => {
                        setLimit(Number(e.target.value));
                        setIsDirty(true);
                    }}
                    className="w-20 rounded border border-input bg-background px-2 py-1 text-center"
                />
            </td>
            <td className="px-4 py-3">
                <input
                    type="text"
                    value={desc}
                    onChange={(e) => {
                        setDesc(e.target.value);
                        setIsDirty(true);
                    }}
                    placeholder="Opsiyonel açıklama"
                    className="w-full rounded border border-input bg-background px-2 py-1"
                />
            </td>
            <td className="px-4 py-3 text-right">
                {isDirty && (
                    <button
                        onClick={() => {
                            onUpdate(material.reference, limit, desc);
                            setIsDirty(false);
                        }}
                        className="p-1 rounded bg-blue-100 text-blue-600 hover:bg-blue-200"
                        title="Kaydet"
                    >
                        <Save className="h-4 w-4" />
                    </button>
                )}
            </td>
        </tr>
    );
}
