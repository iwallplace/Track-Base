'use client';

import { useState, useEffect } from 'react';
import { X, Save, Lock, User, Key, Shield } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { useToast } from '@/components/toast';

interface EditUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    user: {
        id: string;
        name: string;
        username: string;
        role: string;
    } | null;
}

export default function EditUserModal({ isOpen, onClose, onSuccess, user }: EditUserModalProps) {
    const { showToast } = useToast();
    const { t } = useLanguage();
    const [formData, setFormData] = useState({
        name: '',
        username: '',
        password: '', // Only if changing
        role: 'USER'
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name,
                username: user.username,
                password: '',
                role: user.role
            });
        }
    }, [user]);

    if (!isOpen || !user) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const updates: any = {
                id: user.id,
                name: formData.name,
                username: formData.username,
                role: formData.role
            };
            if (formData.password) {
                updates.password = formData.password;
            }

            const res = await fetch('/api/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });

            if (res.ok) {
                onSuccess();
                onClose();
                showToast(t('user_updated'), 'success');
            } else {
                const data = await res.json();
                showToast(data.error || t('error_update'), 'error');
            }
        } catch (error) {
            console.error('Update failed', error);
            showToast(t('error_generic'), 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-card rounded-xl shadow-xl border border-border animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-lg font-semibold text-foreground">{t('edit_user_title')}</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">{t('name_surname')}</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full rounded-lg bg-background border border-input pl-10 pr-4 py-2 text-foreground focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">{t('username_email')}</label>
                        <div className="relative">
                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                required
                                value={formData.username}
                                onChange={e => setFormData({ ...formData, username: e.target.value })}
                                className="w-full rounded-lg bg-background border border-input pl-10 pr-4 py-2 text-foreground focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">
                            {t('new_password')}
                            <span className="text-xs font-normal text-muted-foreground ml-2">{t('password_hint')}</span>
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="password"
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                placeholder="••••••••"
                                className="w-full rounded-lg bg-background border border-input pl-10 pr-4 py-2 text-foreground focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">{t('role')}</label>
                        <div className="relative">
                            <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <select
                                value={formData.role}
                                onChange={e => setFormData({ ...formData, role: e.target.value })}
                                className="w-full rounded-lg bg-background border border-input pl-10 pr-4 py-2 text-foreground focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                            >
                                <option value="USER">{t('role_select_user')}</option>
                                <option value="IME">{t('role_select_ime')}</option>
                                <option value="KALITE">{t('role_select_quality')}</option>
                                <option value="ADMIN">{t('role_select_admin')}</option>
                            </select>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            <Save className="h-4 w-4" />
                            {loading ? t('loading') : t('save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
