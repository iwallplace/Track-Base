'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, AlertTriangle, ChevronRight, UserPlus } from 'lucide-react';
import Link from 'next/link';

interface NotificationItem {
    id: string;
    type: 'low_stock' | 'new_user';
    title: string;
    message: string;
    date: string;
    link?: string;
    meta?: any;
    materialReference?: string;
    company?: string;
    stockCount?: number;
}

export function NotificationsPopover() {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const popoverRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch('/api/notifications');
            if (res.ok) {
                const data: NotificationItem[] = await res.json();
                setNotifications(data);
                setUnreadCount(data.length);
            }
        } catch (error) {
            console.error('Bildirimler alınamadı', error);
        }
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000); // Poll every minute
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleClearAll = async () => {
        const idsToDismiss = notifications.map(n => n.id);

        if (idsToDismiss.length === 0) return;

        try {
            // Optimistic UI update
            setNotifications([]);
            setUnreadCount(0);

            // Send dismissal to server (fire and forget mostly, but good to handle error if critical, here just log)
            // We should send separate requests per type or one request with mixed types?
            // The API takes 'type' as string. But our list has mixed types.
            // Current API design: "type" field in payload applies to ALL ids.
            // My implementation helper `dismissSchema` has `type` field.
            // Schema has `@@unique([userId, notificationId, type])`.

            // OPTION 1: Group by type and send multiple requests.
            const lows = notifications.filter(n => n.type === 'low_stock').map(n => n.id);
            const users = notifications.filter(n => n.type === 'new_user').map(n => n.id);

            if (lows.length > 0) {
                await fetch('/api/notifications/dismiss', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: lows, type: 'low_stock' })
                });
            }

            if (users.length > 0) {
                await fetch('/api/notifications/dismiss', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: users, type: 'new_user' })
                });
            }

        } catch (error) {
            console.error('Dismissal failed', error);
            // Revert optimistic update? Maybe too complex for now.
        }
    };

    return (
        <div className="relative" ref={popoverRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl bg-card border border-border shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
                        <div className="flex items-center gap-2">
                            <Bell className="h-4 w-4 text-blue-500" />
                            <h4 className="font-semibold text-foreground text-sm">Bildirimler</h4>
                            {unreadCount > 0 && <span className="bg-blue-600/20 text-blue-400 text-[10px] px-2 py-0.5 rounded-full">{unreadCount} Yeni</span>}
                        </div>
                        {notifications.length > 0 && (
                            <button
                                onClick={handleClearAll}
                                className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
                            >
                                Temizle
                            </button>
                        )}
                    </div>
                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center flex flex-col items-center gap-3 text-muted-foreground">
                                <Bell className="h-8 w-8 opacity-20" />
                                <p className="text-sm">Okunmamış bildirim yok.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {notifications.map((item) => {
                                    const isLowStock = item.type === 'low_stock';
                                    return (
                                        <div key={item.id} className="p-4 hover:bg-muted/50 transition-colors group relative">
                                            <div className="flex items-start gap-3">
                                                <div className={`mt-1 h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${isLowStock ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
                                                    {isLowStock ? (
                                                        <AlertTriangle className="h-4 w-4 text-red-500" />
                                                    ) : (
                                                        <UserPlus className="h-4 w-4 text-blue-500" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-foreground mb-0.5 line-clamp-1">
                                                        {item.title}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                                                        {item.message}
                                                    </p>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {isLowStock ? item.meta?.company : new Date(item.date).toLocaleDateString('tr-TR')}
                                                        </span>
                                                        <Link
                                                            href={item.link || '#'}
                                                            onClick={() => setIsOpen(false)}
                                                            className="text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            İncele <ChevronRight className="h-3 w-3" />
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
