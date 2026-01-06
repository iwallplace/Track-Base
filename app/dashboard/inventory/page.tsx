'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Download, Plus, Search, Filter, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import AddItemModal from './add-item-modal';
import DateRangePicker from '@/components/date-range-picker';
import { useLanguage } from '@/components/language-provider';
import { useToast } from '@/components/toast';
import { useSession } from 'next-auth/react';
import DeleteConfirmModal from '@/components/delete-confirm-modal';

interface InventoryItem {
    id: string; // Latest Item ID
    year: number;
    month: number;
    week: number;
    date: string;
    company: string;
    waybillNo: string;
    materialReference: string;
    stockCount: number; // Balance
    lastAction: string;
    note: string;
}

export default function DashboardPage() {
    const { t } = useLanguage();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<InventoryItem[]>([]);

    // Filters & Pagination State
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'Giriş' | 'Çıkış'>('ALL');
    const [dateRange, setDateRange] = useState<{ startDate: string, endDate: string } | null>(null);
    const [pageSize, setPageSize] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);

    // Data Stats
    const [totalItems, setTotalItems] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'Giriş' | 'Çıkış'>('Giriş');
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const { data: session } = useSession();
    const [canDelete, setCanDelete] = useState(false);
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, itemId: null as string | null });
    const [showDeleted, setShowDeleted] = useState(false);

    const router = useRouter();
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setStatusDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchItems = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                view: showDeleted ? 'raw' : 'summary', // Force raw view for deleted items
                page: currentPage.toString(),
                limit: pageSize.toString(),
                search: searchTerm,
                status: statusFilter !== 'ALL' ? statusFilter : '',
                showDeleted: showDeleted.toString()
            });

            if (dateRange) {
                params.append('startDate', dateRange.startDate);
                params.append('endDate', dateRange.endDate);
            }

            const res = await fetch(`/api/inventory?${params}`);
            if (res.ok) {
                const response = await res.json();
                const data = response.data || response;

                if (data.items) {
                    setItems(data.items);
                    setTotalItems(data.pagination.total);
                    setTotalPages(data.pagination.totalPages);
                } else {
                    setItems(Array.isArray(data) ? data : []);
                }
            }
        } catch (error) {
            console.error("Failed to fetch inventory", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, [currentPage, pageSize, searchTerm, statusFilter, dateRange, showDeleted]);

    useEffect(() => {
        const checkPermission = async () => {
            if (session?.user?.role) {
                // If ADMIN, check if protected or if DB has granted it.
                // However, fetching /api/permissions gives us the full map.
                try {
                    const res = await fetch('/api/permissions');
                    if (res.ok) {
                        const data = await res.json();
                        const role = session.user.role;
                        // Check if role has inventory.delete
                        // Note: The API returns { permissions: { ROLE: { perm: bool } } }
                        const hasPerm = data.data.permissions[role]?.['inventory.delete'];
                        // Also ADMIN fallback if needed, but our API should return correct map now
                        setCanDelete(!!hasPerm || (role === 'ADMIN' && true)); // Fallback true for ADMIN until DB is populated? No, rely on API.
                        // Actually, let's trust the API.
                        setCanDelete(!!hasPerm);
                    }
                } catch (e) {
                    console.error('Permission check failed', e);
                }
            }
        };
        checkPermission();
    }, [session]);

    const handleDeleteClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation(); // Prevent row click
        setDeleteModal({ isOpen: true, itemId: id });
    };

    const handleConfirmDelete = async () => {
        if (!deleteModal.itemId) return;
        try {
            const res = await fetch(`/api/inventory?id=${deleteModal.itemId}`, { method: 'DELETE' });
            if (res.ok) {
                showToast(t('success'), 'success');
                setDeleteModal({ isOpen: false, itemId: null });
                fetchItems();
            } else {
                showToast(t('error'), 'error');
            }
        } catch (error) {
            console.error(error);
            showToast(t('error'), 'error');
        }
    };

    const handleExport = async () => {
        try {
            const params = new URLSearchParams({
                // page: '1',  <-- Not needed for limit=-1, but keeps API happy
                limit: '-1', // Fetch ALL records
                search: searchTerm,
                status: statusFilter !== 'ALL' ? statusFilter : '',
                // view: 'summary' <-- REMOVED: We want RAW history data for grouping
            });

            if (dateRange) {
                params.append('startDate', dateRange.startDate);
                params.append('endDate', dateRange.endDate);
            }

            const res = await fetch(`/api/inventory?${params}`);
            if (!res.ok) throw new Error('Export failed');

            const response = await res.json();
            // API returns { data: [...] } or { items: [...] } depending on structure. 
            // Our API for raw list returns array directly or inside items?
            // Let's check api/inventory/route.ts -> It returns { items: [...], pagination: ... } for non-summary view too.
            const data = response.data?.items || (response.data && Array.isArray(response.data) ? response.data : []) || response.items || [];

            if (!data.length) {
                showToast(t('no_records'), 'info');
                return;
            }

            // Use the new Excel Export Utility
            const { exportToExcel } = await import('@/lib/excel-export');
            await exportToExcel(data);

            showToast(t('success'), 'success');
        } catch (error) {
            console.error(error);
            showToast(t('error'), 'error');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Giriş': return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
            case 'Çıkış': return 'bg-red-500/10 text-red-500 border border-red-500/20';
            default: return 'bg-gray-500/10 text-gray-500 border border-gray-500/20';
        }
    };

    const getCompanyInitial = (name: string) => name ? name.charAt(0).toUpperCase() : '?';

    const getCompanyColor = (name: string) => {
        const colors = ['bg-blue-600', 'bg-purple-600', 'bg-indigo-600', 'bg-emerald-600', 'bg-orange-600'];
        let hash = 0;
        if (!name) return colors[0];
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    const getStatusLabel = (status: string) => {
        if (status === 'Giriş') return t('status_entry');
        if (status === 'Çıkış') return t('status_exit');
        return status;
    };

    return (
        <div className="space-y-6">
            <AddItemModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchItems}
                mode={modalMode}
            />

            {/* Header Section */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">{t('inventory_title')}</h2>
                    <p className="text-muted-foreground">{t('inventory_desc')}</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    >
                        <Download className="h-4 w-4" />
                        {t('export')}
                    </button>
                    <button
                        onClick={() => {
                            setModalMode('Giriş');
                            setIsModalOpen(true);
                        }}
                        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        {t('add_entry')}
                    </button>
                    <button
                        onClick={() => {
                            setModalMode('Çıkış');
                            setIsModalOpen(true);
                        }}
                        className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        {t('add_exit')}
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={t('search')}
                            className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-4 text-sm text-foreground placeholder-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    <DateRangePicker
                        onChange={(range) => setDateRange(range)}
                        initialRange={undefined}
                    />

                    {/* Status Dropdown */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${statusFilter !== 'ALL'
                                ? 'bg-purple-500/10 border-purple-500/50 text-purple-600'
                                : 'border-input bg-background text-foreground hover:bg-accent'
                                }`}
                        >
                            <Filter className="h-4 w-4" />
                            {statusFilter === 'ALL' ? t('filter_status') : getStatusLabel(statusFilter)}
                            <ChevronDown className={`h-3 w-3 ml-1 opacity-50 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {statusDropdownOpen && (
                            <div className="absolute top-full right-0 mt-2 w-40 rounded-lg border border-border bg-card shadow-lg z-20 py-1 overflow-hidden">
                                <button
                                    onClick={() => { setStatusFilter('ALL'); setStatusDropdownOpen(false); }}
                                    className="w-full text-left px-4 py-2 text-sm hover:bg-muted text-foreground flex items-center justify-between group"
                                >
                                    {t('status_all')}
                                    {statusFilter === 'ALL' && <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                                </button>
                                <button
                                    onClick={() => { setStatusFilter('Giriş'); setStatusDropdownOpen(false); }}
                                    className="w-full text-left px-4 py-2 text-sm hover:bg-muted text-emerald-600 flex items-center justify-between group"
                                >
                                    {t('status_entry')}
                                    {statusFilter === 'Giriş' && <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                                </button>
                                <button
                                    onClick={() => { setStatusFilter('Çıkış'); setStatusDropdownOpen(false); }}
                                    className="w-full text-left px-4 py-2 text-sm hover:bg-muted text-red-600 flex items-center justify-between group"
                                >
                                    {t('status_exit')}
                                    {statusFilter === 'Çıkış' && <div className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                                </button>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => {
                            setSearchTerm('');
                            setStatusFilter('ALL');
                            setDateRange(null);
                        }}
                        className="flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                        <RefreshCw className="h-4 w-4" />
                        {t('cancel')}
                    </button>

                    {/* Admin Only: Show Deleted Items Toggle */}
                    {session?.user?.role === 'ADMIN' && (
                        <button
                            onClick={() => setShowDeleted(!showDeleted)}
                            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${showDeleted
                                ? 'bg-red-500/10 border-red-500/50 text-red-600'
                                : 'border-input bg-background text-muted-foreground hover:bg-accent'
                                }`}
                            title={t('show_deleted_tooltip')}
                        >
                            <Trash2 className="h-4 w-4" />
                            {showDeleted ? t('hide_deleted') : t('show_deleted')}
                        </button>
                    )}
                </div>
            </div>

            {/* Data Table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground border-b border-border">
                            <tr>
                                <th className="px-6 py-4 font-medium">{t('col_year_month')}</th>
                                <th className="px-6 py-4 font-medium">{t('col_week')}</th>
                                <th className="px-6 py-4 font-medium">{t('col_date')}</th>
                                <th className="px-6 py-4 font-medium">{t('col_company')}</th>
                                <th className="px-6 py-4 font-medium">{t('col_waybill')}</th>
                                <th className="px-6 py-4 font-medium">{t('col_reference')}</th>
                                <th className="px-6 py-4 font-medium text-right text-blue-600">{t('col_stock')}</th>
                                <th className="px-6 py-4 font-medium">{t('col_last_action')}</th>
                                <th className="px-6 py-4 font-medium">{t('col_note')}</th>
                                {canDelete && <th className="px-6 py-4 font-medium w-10"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {items.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={9} className="px-6 py-8 text-center text-muted-foreground">
                                        {t('no_records')}
                                    </td>
                                </tr>
                            )}
                            {items.map((item) => (
                                <motion.tr
                                    key={item.materialReference}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    onClick={() => router.push(`/dashboard/inventory/${item.materialReference}?highlight=${item.id}`)}
                                    className="hover:bg-muted/50 transition-colors cursor-pointer group"
                                >
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-foreground">{item.year}</div>
                                        <div className="text-muted-foreground text-xs">/ {item.month}. {t('month')}</div>
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground">
                                        {item.week}. {t('week')}
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                                        {new Date(item.date).toLocaleDateString("tr-TR")}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-white shrink-0 ${getCompanyColor(item.company)}`}>
                                                {getCompanyInitial(item.company)}
                                            </div>
                                            <span className="text-foreground whitespace-nowrap">{item.company}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-muted-foreground text-xs whitespace-nowrap">{item.waybillNo}</td>
                                    <td className="px-6 py-4 font-mono font-medium text-foreground text-sm group-hover:text-blue-600 transition-colors whitespace-nowrap">
                                        {item.materialReference}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-lg text-blue-600">
                                        {item.stockCount.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getStatusColor(item.lastAction)}`}>
                                            {getStatusLabel(item.lastAction)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground max-w-xs truncate">{item.note}</td>
                                    {canDelete && (
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={(e) => handleDeleteClick(e, item.id)}
                                                className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                                                title={t('delete')}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    )}
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="border-t border-border px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="text-sm text-muted-foreground">
                            {t('total_records')} <span className="font-medium text-foreground">{totalItems}</span>
                            {pageSize !== -1 && (
                                <span className="ml-2">
                                    {t('page')} {currentPage}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">{t('page_size')}:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => setPageSize(Number(e.target.value))}
                                className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:border-blue-500 focus:outline-none"
                            >
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                                <option value={-1}>{t('status_all')}</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <DeleteConfirmModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, itemId: null })}
                onConfirm={handleConfirmDelete}
            />
        </div>
    );
}
