'use client';

import { useState, useEffect } from 'react';
import { X, Search, Save, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/toast';

interface Material {
    id: string;
    reference: string;
    minStock: number;
    description?: string;
    abcClass?: string;
    supplier?: string;
    defaultLocation?: string;
    unit?: string;
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

    const handleUpdate = async (reference: string, data: Partial<Material>) => {
        try {
            const res = await fetch('/api/materials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reference, ...data })
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
            <div className="w-full max-w-7xl rounded-2xl border border-border bg-card p-6 shadow-xl flex flex-col max-h-[85vh]">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Malzeme Kartı ve Limit Ayarları</h2>
                        <p className="text-sm text-muted-foreground">Malzeme tanımlarını, kritik stok seviyelerini ve sınıflandırmaları yönetin (SAP/ERP Standardı).</p>
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
                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground sticky top-0 backdrop-blur-md z-10">
                            <tr>
                                <th className="px-4 py-3 min-w-[150px]">Referans</th>
                                <th className="px-4 py-3 w-20">ABC</th>
                                <th className="px-4 py-3 w-24">Kritik Stok</th>
                                <th className="px-4 py-3 w-24">Birim</th>
                                <th className="px-4 py-3 w-32">Vars. Konum</th>
                                <th className="px-4 py-3 w-32">Tedarikçi</th>
                                <th className="px-4 py-3 min-w-[200px]">Açıklama</th>
                                <th className="px-4 py-3 w-16"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {materials.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                                        Kayıt bulunamadı. Veritabanına yeni malzeme eklendikçe burada görünecektir.
                                        <br />
                                        <span className="text-xs italic">(Henüz veritabanında &quot;Material&quot; kaydı yoksa, stok hareketlerinden otomatik oluşturulmaz. Manuel eklemelisiniz.)</span>
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

function MaterialRow({ material, onUpdate }: { material: Material, onUpdate: (ref: string, data: Partial<Material>) => void }) {
    const [minStock, setMinStock] = useState(material.minStock);
    const [desc, setDesc] = useState(material.description ?? '');
    const [abcClass, setAbcClass] = useState(material.abcClass ?? '');
    const [supplier, setSupplier] = useState(material.supplier ?? '');
    const [defaultLocation, setDefaultLocation] = useState(material.defaultLocation ?? '');
    const [unit, setUnit] = useState(material.unit ?? 'Adet');

    const [isDirty, setIsDirty] = useState(false);

    const handleChange = (setter: any, value: any) => {
        setter(value);
        setIsDirty(true);
    };

    return (
        <tr className="hover:bg-muted/50 group text-xs sm:text-sm">
            <td className="px-4 py-2 font-medium font-mono whitespace-nowrap">{material.reference}</td>
            <td className="px-4 py-2">
                <select
                    value={abcClass}
                    onChange={(e) => handleChange(setAbcClass, e.target.value)}
                    className="w-full rounded border border-input bg-background px-2 py-1 focus:outline-none focus:border-blue-500"
                >
                    <option value="">-</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                </select>
            </td>
            <td className="px-4 py-2">
                <input
                    type="number"
                    min="0"
                    value={minStock}
                    onChange={(e) => handleChange(setMinStock, Number(e.target.value))}
                    className="w-full rounded border border-input bg-background px-2 py-1 text-center focus:outline-none focus:border-blue-500"
                />
            </td>
            <td className="px-4 py-2">
                <input
                    type="text"
                    value={unit}
                    onChange={(e) => handleChange(setUnit, e.target.value)}
                    className="w-full rounded border border-input bg-background px-2 py-1 focus:outline-none focus:border-blue-500"
                />
            </td>
            <td className="px-4 py-2">
                <input
                    type="text"
                    value={defaultLocation}
                    onChange={(e) => handleChange(setDefaultLocation, e.target.value)}
                    placeholder="Örn: A1-R2"
                    className="w-full rounded border border-input bg-background px-2 py-1 focus:outline-none focus:border-blue-500"
                />
            </td>
            <td className="px-4 py-2">
                <input
                    type="text"
                    value={supplier}
                    onChange={(e) => handleChange(setSupplier, e.target.value)}
                    placeholder="Firma Adı"
                    className="w-full rounded border border-input bg-background px-2 py-1 focus:outline-none focus:border-blue-500"
                />
            </td>
            <td className="px-4 py-2">
                <input
                    type="text"
                    value={desc}
                    onChange={(e) => handleChange(setDesc, e.target.value)}
                    placeholder="Açıklama"
                    className="w-full rounded border border-input bg-background px-2 py-1 focus:outline-none focus:border-blue-500"
                />
            </td>
            <td className="px-4 py-2 text-right">
                {isDirty && (
                    <button
                        onClick={() => {
                            onUpdate(material.reference, {
                                minStock,
                                description: desc,
                                abcClass: abcClass || undefined,
                                supplier: supplier || undefined,
                                defaultLocation: defaultLocation || undefined,
                                unit
                            });
                            setIsDirty(false);
                        }}
                        className="p-1.5 rounded bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                        title="Değişiklikleri Kaydet"
                    >
                        <Save className="h-4 w-4" />
                    </button>
                )}
            </td>
        </tr>
    );
}
