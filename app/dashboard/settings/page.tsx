'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { User, Lock, Mail, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
    const { data: session, update } = useSession();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const [formData, setFormData] = useState({
        name: session?.user?.name || '',
        username: '', // Will be populated in useEffect if we fetch fresh, or from session but session might lack email field if different from name
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        image: session?.user?.image || ''
    });

    const avatarSeeds = [
        'Felix', 'Aneka', 'Zack', 'Troublesong', 'Barrade',
        'Milo', 'Morpheus', 'Ginger', 'Callie', 'Sam',
        'Bandit', 'Coco', 'Tiger', 'Leo', 'Max',
        'Bella', 'Charlie', 'Jack', 'Lucy', 'Simba'
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });
        setLoading(true);

        if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
            setMessage({ type: 'error', text: 'Yeni şifreler eşleşmiyor.' });
            setLoading(false);
            return;
        }

        try {
            const res = await fetch('/api/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    username: formData.username || undefined, // Only send if changed/set
                    currentPassword: formData.currentPassword,
                    newPassword: formData.newPassword,
                    image: formData.image
                })
            });

            if (res.ok) {
                setMessage({ type: 'success', text: 'Profil başarıyla güncellendi.' });
                // Ideally update session client side
                await update({ name: formData.name, image: formData.image });
                setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
            } else {
                try {
                    const data = await res.json();
                    setMessage({ type: 'error', text: data.error || 'Güncelleme başarısız.' });
                } catch {
                    const text = await res.text();
                    setMessage({ type: 'error', text: text || 'Güncelleme başarısız.' });
                }
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Bir hata oluştu.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-foreground">Ayarlar</h2>
                <p className="text-muted-foreground">Profil bilgilerinizi ve hesap güvenliğinizi yönetin.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Standard Avatars */}
                <div className="rounded-xl border border-border bg-card p-6 space-y-6 text-foreground">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                        <User className="h-5 w-5 text-pink-500" />
                        Profil Resmi Seçimi
                    </h3>

                    <div className="space-y-4">
                        <p className="text-sm font-medium text-muted-foreground">İnsan Karakterler</p>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
                            {avatarSeeds.map((seed) => {
                                const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&mouth=smile&eyebrows=default&eyes=default`;
                                const isSelected = formData.image === avatarUrl;
                                return (
                                    <button
                                        key={seed}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, image: avatarUrl })}
                                        className={`relative aspect-square rounded-full overflow-hidden border-2 transition-all ${isSelected ? 'border-blue-500 scale-110 ring-2 ring-blue-500/50' : 'border-input hover:border-gray-500 hover:scale-105'
                                            }`}
                                    >
                                        <img
                                            src={avatarUrl}
                                            alt={seed}
                                            className="w-full h-full object-cover"
                                        />
                                        {isSelected && (
                                            <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                                <CheckCircle2 className="h-6 w-6 text-white drop-shadow-md" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-border">
                        <p className="text-sm font-medium text-muted-foreground">Çizgi & Eğlenceli Karakterler</p>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
                            {['Bear', 'Rabbit', 'Cat', 'Dog', 'Lion', 'Panda', 'Robot1', 'Robot2', 'Ghost', 'Alien'].map((seed) => {
                                const styles = ['fun-emoji', 'bottts', 'adventurer'];
                                const style = seed.startsWith('Robot') ? 'bottts' : (['Ghost', 'Bear'].includes(seed) ? 'fun-emoji' : 'adventurer');
                                const avatarUrl = `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;
                                const isSelected = formData.image === avatarUrl;

                                return (
                                    <button
                                        key={seed}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, image: avatarUrl })}
                                        className={`relative aspect-square rounded-full overflow-hidden border-2 transition-all ${isSelected ? 'border-blue-500 scale-110 ring-2 ring-blue-500/50' : 'border-input hover:border-gray-500 hover:scale-105'
                                            }`}
                                    >
                                        <img
                                            src={avatarUrl}
                                            alt={seed}
                                            className="w-full h-full object-cover bg-slate-100"
                                        />
                                        {isSelected && (
                                            <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                                <CheckCircle2 className="h-6 w-6 text-white drop-shadow-md" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Profile Information */}
                <div className="rounded-xl border border-border bg-card p-6 space-y-6 text-foreground">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                        <User className="h-5 w-5 text-blue-500" />
                        Kişisel Bilgiler
                    </h3>

                    <div className="grid gap-6">
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">
                                Ad Soyad
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full rounded-lg bg-background border border-input px-4 py-2.5 text-foreground focus:border-blue-500 focus:outline-none"
                                placeholder="Adınız Soyadınız"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">
                                E-posta / Kullanıcı Adı
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={formData.username}
                                    // Use placeholder from session if empty? 
                                    // Better to init with session value.
                                    placeholder={session?.user?.email || "Kullanıcı Adı"}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    className="w-full rounded-lg bg-background border border-input pl-10 pr-4 py-2.5 text-foreground focus:border-blue-500 focus:outline-none"
                                />
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Bu adres ile sisteme giriş yapacaksınız.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Password Change */}
                <div className="rounded-xl border border-border bg-card p-6 space-y-6 text-foreground">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                        <Lock className="h-5 w-5 text-purple-500" />
                        Şifre Değiştir
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">
                                Mevcut Şifre
                            </label>
                            <input
                                type="password"
                                value={formData.currentPassword}
                                onChange={e => setFormData({ ...formData, currentPassword: e.target.value })}
                                className="w-full rounded-lg bg-background border border-input px-4 py-2.5 text-foreground focus:border-blue-500 focus:outline-none"
                                placeholder="••••••••"
                            />
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">
                                    Yeni Şifre
                                </label>
                                <input
                                    type="password"
                                    value={formData.newPassword}
                                    onChange={e => setFormData({ ...formData, newPassword: e.target.value })}
                                    className="w-full rounded-lg bg-background border border-input px-4 py-2.5 text-foreground focus:border-blue-500 focus:outline-none"
                                    placeholder="••••••••"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">
                                    Yeni Şifre (Tekrar)
                                </label>
                                <input
                                    type="password"
                                    value={formData.confirmPassword}
                                    onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                                    className="w-full rounded-lg bg-background border border-input px-4 py-2.5 text-foreground focus:border-blue-500 focus:outline-none"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Feedback Message */}
                {message.text && (
                    <div className={`p-4 rounded-lg flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                        }`}>
                        {message.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                        <p className="text-sm font-medium">{message.text}</p>
                    </div>
                )}

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Save className="h-4 w-4" />
                        {loading ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                    </button>
                </div>
            </form>
        </div>
    );
}
