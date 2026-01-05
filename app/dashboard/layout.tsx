'use client';

import { LayoutDashboard, Package, Users, Settings, LogOut, Menu, BarChart3, Building2 } from 'lucide-react';
import Link from 'next/link';
import { ModeToggle } from '@/components/theme-toggle';
import { NotificationsPopover } from '@/components/notifications-popover';
import { PatronChat } from '@/components/ai/patron-chat';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useState } from 'react';

const navigation = [
    { name: 'Dashboard', href: '/dashboard/reports', icon: LayoutDashboard },
    { name: 'Malzeme Stok Takibi', href: '/dashboard/inventory', icon: Package },
    { name: 'Raporlar', href: '/dashboard/reports', icon: BarChart3 },
    { name: 'Firmalar', href: '/dashboard/companies', icon: Building2 },
    { name: 'Ayarlar', href: '/dashboard/settings', icon: Settings },
];

const getPageTitle = (pathname: string) => {
    if (pathname.includes('/inventory')) return 'Malzeme Stok Takibi';
    if (pathname.includes('/companies')) return 'Firmalar';
    if (pathname.includes('/settings')) return 'Ayarlar';
    if (pathname.includes('/reports')) return 'Raporlar';
    return 'Dashboard';
};

export default function DashboardLayoutContent({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const [collapsed, setCollapsed] = useState(false);

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
                                key={item.name}
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
                                <p className="truncate text-sm font-medium text-foreground">{session?.user?.name || 'Kullanıcı'}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                    {session?.user?.role === 'ADMIN' ? 'Project Owner' :
                                        session?.user?.role === 'USER' ? 'İnci Personeli' :
                                            session?.user?.role === 'IME' ? 'IME' :
                                                session?.user?.role === 'KALITE' ? 'Kalite' :
                                                    'Kullanıcı'}
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
                        {/* Breadcrumb or Title placeholder */}
                    </div>
                    <div className="flex items-center gap-4">
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
