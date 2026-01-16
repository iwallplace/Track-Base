'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastAction {
    label: string;
    onClick: () => void;
}

interface Toast {
    id: string;
    message: string;
    type: ToastType;
    action?: ToastAction;
}

interface ToastContextType {
    showToast: (message: string, type: ToastType, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const showToast = useCallback((message: string, type: ToastType, action?: ToastAction) => {
        const id = Math.random().toString(36).substring(7);
        setToasts((prev) => [...prev, { id, message, type, action }]);

        // Auto dismiss after 3 seconds (or longer if there is an action)
        // If action exists, maybe longer? Let's say 5s for action, 3s for normal.
        const duration = action ? 8000 : 3000;

        setTimeout(() => {
            removeToast(id);
        }, duration);
    }, [removeToast]);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                <AnimatePresence>
                    {toasts.map((toast) => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, y: 20, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 20, scale: 0.9 }}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-md min-w-[300px] pointer-events-auto
                                ${toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : ''}
                                ${toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-600' : ''}
                                ${toast.type === 'info' ? 'bg-blue-500/10 border-blue-500/20 text-blue-600' : ''}
                            `}
                        >
                            <span className={`p-1 rounded-full 
                                ${toast.type === 'success' ? 'bg-emerald-500/20' : ''}
                                ${toast.type === 'error' ? 'bg-red-500/20' : ''}
                                ${toast.type === 'info' ? 'bg-blue-500/20' : ''}
                            `}>
                                {toast.type === 'success' && <CheckCircle className="h-4 w-4" />}
                                {toast.type === 'error' && <AlertCircle className="h-4 w-4" />}
                                {toast.type === 'info' && <Info className="h-4 w-4" />}
                            </span>

                            <div className="flex-1 flex flex-col gap-1">
                                <p className="text-sm font-medium">{toast.message}</p>
                            </div>

                            {toast.action && (
                                <button
                                    onClick={() => {
                                        toast.action?.onClick();
                                        removeToast(toast.id);
                                    }}
                                    className="px-3 py-1.5 text-xs font-semibold bg-white/20 hover:bg-white/30 rounded-lg transition-colors border border-white/10 shrink-0"
                                >
                                    {toast.action.label}
                                </button>
                            )}

                            <button
                                onClick={() => removeToast(toast.id)}
                                className="opacity-70 hover:opacity-100 transition-opacity ml-1"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}
