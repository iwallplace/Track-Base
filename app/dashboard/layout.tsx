'use client';

import { LayoutDashboard, Package, Users, Settings, LogOut } from 'lucide-react';
import Link from 'next/link';
import { ModeToggle } from '@/components/theme-toggle';
import { NotificationsPopover } from '@/components/notifications-popover';
import { PatronChat } from '@/components/ai/patron-chat';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useState } from 'react';
import { useLanguage } from '@/components/language-provider';
import { LanguageSwitcher } from '@/components/language-switcher';

export default function DashboardLayoutContent({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const [collapsed, setCollapsed] = useState(false);
    const { t } = useLanguage();

    const navigation = [
        { name: t('dashboard'), href: '/dashboard', icon: LayoutDashboard },
        { name: t('inventory'), href: '/dashboard/inventory', icon: Package },
        { name: t('users'), href: '/dashboard/users', icon: Users },
        { name: t('settings'), href: '/dashboard/settings', icon: Settings },
    ];

    const getPageTitle = (pathname: string) => {
        if (pathname === '/dashboard') return t('dashboard');
        if (pathname.includes('/inventory')) return t('inventory_title');
        if (pathname.includes('/users')) return t('users');
        if (pathname.includes('/settings')) return t('settings');
        return t('dashboard');
    };

    const getUserRoleLabel = (role: string | undefined) => {
        if (!role) return t('role_unknown');
        if (role === 'ADMIN') return t('role_admin');
        if (role === 'USER') return t('role_user');
        if (role === 'IME') return t('role_ime');
        if (role === 'KALITE') return t('role_quality');
        return role;
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex">
            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-card transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'}`}>

                {/* Logo */}
                <div className="flex h-16 items-center px-6 border-b border-border">
                    <div className="flex h-8 w-8 items-center justify-center rounded-none bg-primary mr-3">
                        <span className="font-bold text-primary-foreground">P</span>
                    </div>
                    {!collapsed && (
                        <div>
                            <h1 className="text-sm font-bold text-foreground">Project Track Base</h1>
                            <p className="text-xs text-muted-foreground font-medium whitespace-nowrap">Architected by <Link href="https://www.linkedin.com/in/ahmetmersin/" target="_blank" className="text-muted-foreground font-bold hover:text-primary transition-colors">MERSIN AXIOM</Link></p>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 space-y-1 px-3 py-4">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${isActive
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                                    }`}
                            >
                                <item.icon
                                    className={`flex-shrink-0 h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                                        } ${collapsed ? 'mx-auto' : 'mr-3'}`}
                                    aria-hidden="true"
                                />
                                {!collapsed && item.name}
                            </Link>
                        );
                    })}
                </nav>

                {/* User Profile */}
                <div className="border-t border-border p-4">
                    <div className={`flex items-center ${collapsed ? 'justify-center' : ''}`}>
                        <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 text-primary font-medium overflow-hidden">
                            {session?.user?.image ? (
                                <img src={session.user.image} alt={session.user.name || 'User'} className="h-full w-full object-cover" />
                            ) : (
                                <span>{session?.user?.name?.[0] || 'U'}</span>
                            )}
                        </div>
                        {!collapsed && (
                            <div className="ml-3 overflow-hidden">
                                <p className="truncate text-sm font-medium text-foreground">{session?.user?.name || t('role_unknown')}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                    {getUserRoleLabel(session?.user?.role)}
                                </p>
                            </div>
                        )}
                        {!collapsed && (
                            <button
                                onClick={() => signOut()}
                                className="ml-auto text-muted-foreground hover:text-foreground"
                            >
                                <LogOut className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className={`flex-1 flex flex-col transition-all duration-300 ${collapsed ? 'ml-20' : 'ml-64'}`}>
                {/* Header */}
                <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 z-30">
                    <div className="flex items-center gap-3 text-muted-foreground">
                        <LayoutDashboard className="h-5 w-5" />
                        <span className="font-medium text-foreground capitalize">{getPageTitle(pathname)}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <LanguageSwitcher />
                        <ModeToggle />
                        <NotificationsPopover />
                        <Link href="/dashboard/settings" className="text-muted-foreground hover:text-foreground">
                            <Settings className="h-5 w-5" />
                        </Link>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-auto bg-background p-6 relative">
                    {children}
                </main>
            </div>

            {/* AI Assistant - Patron Mode */}
            <PatronChat />
        </div>
    );
}
