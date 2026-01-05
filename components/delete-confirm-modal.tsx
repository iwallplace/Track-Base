'use client';

import { X, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';

interface DeleteConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    description?: string;
}

export default function DeleteConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
}: DeleteConfirmModalProps) {
    const { t } = useLanguage();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
            <div
                className="w-full max-w-md bg-card rounded-lg shadow-lg border border-border overflow-hidden animate-in zoom-in-95 duration-200"
                role="dialog"
                aria-modal="true"
            >
                <div className="flex items-center justify-between border-b border-border p-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        {title || t('confirm_delete')}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6">
                    <p className="text-muted-foreground">
                        {description || t('confirm_delete_message')}
                    </p>
                </div>

                <div className="flex items-center justify-end gap-3 bg-muted/50 p-4 border-t border-border">
                    <button
                        onClick={onClose}
                        className="rounded-md px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        onClick={onConfirm}
                        className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
                    >
                        {t('delete')}
                    </button>
                </div>
            </div>
        </div>
    );
}
