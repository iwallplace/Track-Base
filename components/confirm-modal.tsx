'use client';

import { X, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    loading?: boolean;
}

export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = 'Onayla',
    cancelText = 'İptal',
    variant = 'warning',
    loading = false,
}: ConfirmModalProps) {
    if (!isOpen) return null;

    const icons = {
        danger: <AlertTriangle className="h-5 w-5" />,
        warning: <AlertTriangle className="h-5 w-5" />,
        info: <HelpCircle className="h-5 w-5" />,
    };

    const headerColors = {
        danger: 'text-red-600',
        warning: 'text-amber-600',
        info: 'text-blue-600',
    };

    const buttonColors = {
        danger: 'bg-red-600 hover:bg-red-700 text-white',
        warning: 'bg-amber-600 hover:bg-amber-700 text-white',
        info: 'bg-blue-600 hover:bg-blue-700 text-white',
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div
                className="w-full max-w-md bg-card rounded-xl shadow-xl border border-border overflow-hidden animate-in zoom-in-95 duration-200"
                role="dialog"
                aria-modal="true"
            >
                <div className="flex items-center justify-between border-b border-border p-4">
                    <h2 className={`text-lg font-semibold flex items-center gap-2 ${headerColors[variant]}`}>
                        {icons[variant]}
                        {title}
                    </h2>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6">
                    <p className="text-muted-foreground">
                        {description}
                    </p>
                </div>

                <div className="flex items-center justify-end gap-3 bg-muted/50 p-4 border-t border-border">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        disabled={loading}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${buttonColors[variant]}`}
                    >
                        {loading ? 'İşleniyor...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
