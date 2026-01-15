'use client';

import { useState, useEffect } from 'react';
import { Trash2, UserPlus, Shield, ShieldAlert, Key, ChevronDown, ChevronUp, Pencil, Loader2, RotateCcw, Plus, Tag } from 'lucide-react';
import { useSession } from 'next-auth/react';
import EditUserModal from './edit-user-modal';
import DeleteConfirmModal from '@/components/delete-confirm-modal';
import { useToast } from '@/components/toast';
import { useLanguage } from '@/components/language-provider';

interface User {
    id: string;
    name: string;
    username: string;
    role: string;
    createdAt: string;
    deletedAt?: string;
}

interface Role {
    id: string;
    name: string;
    label: string;
    color: string;
    isSystem: boolean;
}

interface PermissionsData {
    permissions: Record<string, Record<string, boolean>>;
    labels: Record<string, string>;
    roleLabels: Record<string, string>;
}

export default function UsersPage() {
    const { data: session } = useSession();
    const { showToast } = useToast();
    const { t } = useLanguage();

    // Data State
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);

    // New User State
    const [newUser, setNewUser] = useState({ name: '', username: '', password: '', role: 'USER' });

    // UI State
    const [showRolePanel, setShowRolePanel] = useState(false);
    const [showRolesManager, setShowRolesManager] = useState(false);
    const [newRole, setNewRole] = useState({ name: '', label: '', color: 'blue' });

    // Modal State
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, userId: null as string | null });

    // Dynamic permissions state
    const [permissionsData, setPermissionsData] = useState<PermissionsData | null>(null);
    const [permLoading, setPermLoading] = useState(false);
    const [updatingPerm, setUpdatingPerm] = useState<string | null>(null);

    const [showDeleted, setShowDeleted] = useState(false);

    const isAdmin = session?.user?.role === 'ADMIN';
    const canManageUsers = ['ADMIN', 'IME', 'KALITE', 'SCL'].includes(session?.user?.role || '');

    const fetchRoles = async () => {
        try {
            const res = await fetch('/api/roles');
            if (res.ok) {
                const response = await res.json();
                setRoles(response.data || response);
            }
        } catch (error) {
            console.error("Roles fetch error:", error);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch(`/api/users?showDeleted=${showDeleted}`);
            if (res.ok) {
                const response = await res.json();
                const data = response.data || response;
                setUsers(Array.isArray(data) ? data : []);
            } else {
                if (res.status === 401) {
                    showToast(t('session_expired') || "Oturum süresi doldu", 'error');
                } else {
                    showToast(t('error_fetch') || "Veri yüklenemedi", 'error');
                }
            }
        } catch (error) {
            showToast(t('conn_error'), 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchPermissions = async () => {
        setPermLoading(true);
        try {
            const res = await fetch('/api/permissions');
            if (res.ok) {
                const response = await res.json();
                setPermissionsData(response.data || response);
            }
        } catch (error) {
            showToast(t('error_permissions'), 'error');
        } finally {
            setPermLoading(false);
        }
    };

    useEffect(() => {
        if (session) {
            fetchRoles();
            fetchUsers();
            if (isAdmin) fetchPermissions();
        }
    }, [session, isAdmin, showDeleted]);

    // Role Management
    const handleAddRole = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newRole)
            });
            if (res.ok) {
                fetchRoles();
                setNewRole({ name: '', label: '', color: 'blue' });
                showToast("Rol oluşturuldu", 'success');
            } else {
                const data = await res.json();
                showToast(data.error || "Hata oluştu", 'error');
            }
        } catch (error) {
            showToast(t('conn_error'), 'error');
        }
    };

    const handleDeleteRole = async (id: string) => {
        if (!confirm("Bu rolü silmek istediğinize emin misiniz?")) return;
        try {
            const res = await fetch(`/api/roles?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchRoles();
                showToast("Rol silindi", 'success');
            } else {
                const data = await res.json();
                showToast(data.error || "Silinemedi", 'error');
            }
        } catch (error) {
            showToast(t('conn_error'), 'error');
        }
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser)
            });

            const data = await res.json();

            if (res.ok) {
                setNewUser({ name: '', username: '', password: '', role: 'USER' });
                fetchUsers();
                showToast(t('user_added'), 'success');
            } else {
                showToast(data.error || t('error_user_add'), 'error');
            }
        } catch (error) {
            showToast(t('conn_error'), 'error');
        }
    };

    const handleDeleteUser = (id: string) => {
        setDeleteModal({ isOpen: true, userId: id });
    };

    const handleConfirmDelete = async () => {
        if (!deleteModal.userId) return;

        try {
            const res = await fetch(`/api/users?id=${deleteModal.userId}`, { method: 'DELETE' });
            if (res.ok) {
                fetchUsers();
                showToast(t('user_deleted'), 'success');
                setDeleteModal({ isOpen: false, userId: null });
            } else {
                const data = await res.json();
                showToast(data.error || t('error_delete'), 'error');
            }
        } catch (error) {
            showToast(t('error_generic'), 'error');
        }
    };

    const handleTogglePermission = async (role: string, permission: string, currentValue: boolean) => {
        const key = `${role}-${permission}`;
        setUpdatingPerm(key);

        try {
            const res = await fetch('/api/permissions', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role, permission, granted: !currentValue })
            });

            if (res.ok) {
                // Update local state
                setPermissionsData(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        permissions: {
                            ...prev.permissions,
                            [role]: {
                                ...prev.permissions[role],
                                [permission]: !currentValue
                            }
                        }
                    };
                });
                showToast(t('permission_updated'), 'success');
            } else {
                const data = await res.json();
                showToast(data.error || t('error_update'), 'error');
            }
        } catch (error) {
            showToast(t('conn_error'), 'error');
        } finally {
            setUpdatingPerm(null);
        }
    };

    const getRoleBadge = (roleCode: string) => {
        const role = roles.find(r => r.name === roleCode);
        const label = role?.label || roleCode;
        const color = role?.color || 'gray';

        let colorClasses = 'bg-secondary text-secondary-foreground border-border';

        switch (color) {
            case 'purple': colorClasses = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'; break;
            case 'blue': colorClasses = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'; break;
            case 'emerald': colorClasses = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'; break;
            case 'orange': colorClasses = 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'; break;
            case 'red': colorClasses = 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'; break;
        }

        return (
            <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs border ${colorClasses}`}>
                {roleCode === 'ADMIN' && <Shield className="h-3 w-3" />}
                {label}
            </span>
        );
    };

    if (!session) return null;

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <EditUserModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSuccess={fetchUsers}
                user={editingUser}
                roles={roles}
            />

            <DeleteConfirmModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, userId: null })}
                onConfirm={handleConfirmDelete}
                title={t('confirm_delete')}
                description={t('confirm_delete_message')}
            />

            <div>
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground">{t('user_management_title')}</h2>
                        <p className="text-muted-foreground">{t('user_management_desc')}</p>
                    </div>
                    {session?.user?.role === 'ADMIN' && (
                        <button
                            onClick={() => setShowDeleted(!showDeleted)}
                            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-medium transition-colors ${showDeleted
                                ? 'bg-red-500/10 border-red-500/50 text-red-600'
                                : 'border-input bg-background text-muted-foreground hover:bg-accent'
                                }`}
                        >
                            <Trash2 className="h-3 w-3" />
                            {showDeleted ? t('hide_deleted') : t('show_deleted')}
                        </button>
                    )}
                </div>
            </div>

            {/* Role Management Panel - ADMIN Only */}
            {isAdmin && (
                <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                    <button
                        onClick={() => setShowRolesManager(!showRolesManager)}
                        className="w-full flex items-center justify-between p-6 hover:bg-muted/50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <Tag className="h-5 w-5 text-blue-500" />
                            <div className="text-left">
                                <h3 className="text-lg font-medium text-foreground">Rol Yönetimi</h3>
                                <p className="text-sm text-muted-foreground">Yeni roller ekleyin veya düzenleyin</p>
                            </div>
                        </div>
                        {showRolesManager ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                    </button>

                    {showRolesManager && (
                        <div className="border-t border-border p-6 bg-muted/30">
                            <div className="grid md:grid-cols-2 gap-8">
                                {/* Add Role Form */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-semibold text-foreground">Yeni Rol Oluştur</h4>
                                    <form onSubmit={handleAddRole} className="space-y-4 rounded-lg bg-background border border-border p-4">
                                        <div>
                                            <label className="text-xs text-muted-foreground block mb-1">Rol Kodu (Benzersiz)</label>
                                            <input
                                                required
                                                placeholder="Örn: VARDIYA_AMIRI"
                                                value={newRole.name}
                                                onChange={e => setNewRole({ ...newRole, name: e.target.value.toUpperCase() })}
                                                className="w-full px-3 py-2 rounded border border-input text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-muted-foreground block mb-1">Rol Etiketi (Görünecek Ad)</label>
                                            <input
                                                required
                                                placeholder="Örn: Vardiya Amiri"
                                                value={newRole.label}
                                                onChange={e => setNewRole({ ...newRole, label: e.target.value })}
                                                className="w-full px-3 py-2 rounded border border-input text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-muted-foreground block mb-1">Renk</label>
                                            <select
                                                value={newRole.color}
                                                onChange={e => setNewRole({ ...newRole, color: e.target.value })}
                                                className="w-full px-3 py-2 rounded border border-input text-sm"
                                            >
                                                <option value="gray">Gri</option>
                                                <option value="blue">Mavi</option>
                                                <option value="purple">Mor</option>
                                                <option value="emerald">Yeşil</option>
                                                <option value="orange">Turuncu</option>
                                                <option value="red">Kırmızı</option>
                                            </select>
                                        </div>
                                        <button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded py-2 text-sm font-medium">Olustur</button>
                                    </form>
                                </div>

                                {/* Roles List */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-semibold text-foreground">Mevcut Roller</h4>
                                    <div className="space-y-2">
                                        {roles.map(role => (
                                            <div key={role.id} className="flex items-center justify-between p-3 rounded bg-background border border-border">
                                                <div className="flex items-center gap-3">
                                                    {getRoleBadge(role.name)}
                                                    <span className="text-xs text-muted-foreground font-mono">{role.name}</span>
                                                </div>
                                                {!['ADMIN', 'USER'].includes(role.name) && (
                                                    <button
                                                        onClick={() => handleDeleteRole(role.id)}
                                                        className="text-muted-foreground hover:text-red-500"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {['ADMIN', 'USER'].includes(role.name) && <span className="text-[10px] bg-muted px-2 py-1 rounded">Sistem</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Role Permissions Panel - ADMIN Only */}
            {isAdmin && (
                <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                    <button
                        onClick={() => setShowRolePanel(!showRolePanel)}
                        className="w-full flex items-center justify-between p-6 hover:bg-muted/50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <Key className="h-5 w-5 text-purple-500" />
                            <div className="text-left">
                                <h3 className="text-lg font-medium text-foreground">{t('role_permissions')}</h3>
                                <p className="text-sm text-muted-foreground">{t('role_permissions_desc')}</p>
                            </div>
                        </div>
                        {showRolePanel ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                    </button>

                    {showRolePanel && (
                        <div className="border-t border-border p-6">
                            {permLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    <span className="ml-2 text-muted-foreground">{t('permissions_loading')}</span>
                                </div>
                            ) : permissionsData ? (
                                <>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-left">
                                                    <th className="pb-4 pr-4 font-medium text-muted-foreground">{t('permission_col')}</th>
                                                    {roles.map((role) => (
                                                        <th key={role.name} className="pb-4 px-4 text-center font-medium">
                                                            {getRoleBadge(role.name)}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {Object.entries(permissionsData.labels).map(([permKey, permLabel]) => (
                                                    <tr key={permKey} className="hover:bg-muted/50">
                                                        <td className="py-3 pr-4 text-foreground">{permLabel}</td>
                                                        {roles.map((role) => {
                                                            const granted = permissionsData.permissions[role.name]?.[permKey] ?? false;
                                                            const isUpdating = updatingPerm === `${role.name}-${permKey}`;
                                                            const isProtected = role.name === 'ADMIN';

                                                            return (
                                                                <td key={role.name} className="py-3 px-4 text-center">
                                                                    <button
                                                                        onClick={() => !isProtected && handleTogglePermission(role.name, permKey, granted)}
                                                                        disabled={isUpdating || isProtected}
                                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-background
                                                                            ${granted ? 'bg-emerald-600' : 'bg-muted-foreground'}
                                                                            ${isProtected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}
                                                                        `}
                                                                    >
                                                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${granted ? 'translate-x-6' : 'translate-x-1'}`} />
                                                                    </button>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">{t('error_permissions')}</div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Add User Form */}
            {canManageUsers && (
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                    <h3 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-blue-500" />
                        {t('add_user')}
                    </h3>
                    <form onSubmit={handleAddUser} className="grid md:grid-cols-5 gap-4 items-end">
                        <div className="md:col-span-1">
                            <label className="block text-xs text-muted-foreground mb-1">{t('name_surname')}</label>
                            <input
                                required
                                value={newUser.name}
                                onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                                className="w-full rounded bg-background border border-input px-3 py-2 text-foreground text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs text-muted-foreground mb-1">{t('username_email')}</label>
                            <input
                                required
                                value={newUser.username}
                                onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                className="w-full rounded bg-background border border-input px-3 py-2 text-foreground text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs text-muted-foreground mb-1">{t('password')}</label>
                            <input
                                required
                                type="password"
                                value={newUser.password}
                                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                className="w-full rounded bg-background border border-input px-3 py-2 text-foreground text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs text-muted-foreground mb-1">{t('role')}</label>
                            <select
                                value={newUser.role}
                                onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                className="w-full rounded bg-background border border-input px-3 py-2 text-foreground text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            >
                                {roles.map(role => (
                                    <option key={role.id} value={role.name}>{role.label}</option>
                                ))}
                            </select>
                        </div>
                        <button className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2 text-sm font-medium transition-colors">
                            {t('add')}
                        </button>
                    </form>
                </div>
            )}

            {/* Users List */}
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground border-b border-border">
                        <tr>
                            <th className="px-6 py-4">{t('table_user')}</th>
                            <th className="px-6 py-4">{t('table_role')}</th>
                            <th className="px-6 py-4">{t('table_date')}</th>
                            {canManageUsers && <th className="px-6 py-4 text-right">{t('table_action')}</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {users.map(user => {
                            const canAction = session?.user?.role === 'ADMIN'
                                ? user.role !== 'ADMIN'
                                : user.role === 'USER'; // Can update logic later if needed for managers

                            return (
                                <tr key={user.id} className={`hover:bg-muted/50 transition-colors ${user.deletedAt ? 'bg-red-500/5 hover:bg-red-500/10' : ''}`}>
                                    <td className="px-6 py-4">
                                        <div className={`font-medium text-foreground ${user.deletedAt ? 'opacity-50' : ''}`}>{user.name}</div>
                                        <div className="text-muted-foreground text-xs text-ellipsis">{user.username}</div>
                                        {user.deletedAt && (
                                            <span className="mt-1 inline-flex items-center rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-600 border border-red-500/20">
                                                {t('status_deleted')}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className={user.deletedAt ? 'opacity-50' : ''}>
                                            {getRoleBadge(user.role)}
                                        </div>
                                    </td>
                                    <td className={`px-6 py-4 text-muted-foreground ${user.deletedAt ? 'opacity-50' : ''}`}>
                                        {new Date(user.createdAt).toLocaleDateString()}
                                    </td>
                                    {canManageUsers && (
                                        <td className="px-6 py-4 text-right">
                                            {canAction && (
                                                <div className="flex justify-end gap-2">
                                                    {user.deletedAt ? (
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    const res = await fetch('/api/users', {
                                                                        method: 'PATCH',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ id: user.id, action: 'restore' })
                                                                    });
                                                                    if (res.ok) {
                                                                        showToast(t('restore_success'), 'success');
                                                                        fetchUsers();
                                                                    } else {
                                                                        showToast(t('restore_failed'), 'error');
                                                                    }
                                                                } catch (error) {
                                                                    showToast(t('error_generic'), 'error');
                                                                }
                                                            }}
                                                            className="p-2 text-muted-foreground hover:text-blue-500 transition-colors"
                                                            title={t('restore')}
                                                        >
                                                            <RotateCcw className="h-4 w-4" />
                                                        </button>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    setEditingUser(user);
                                                                    setIsEditModalOpen(true);
                                                                }}
                                                                className="p-2 text-muted-foreground hover:text-blue-500 transition-colors"
                                                                title={t('edit')}
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteUser(user.id)}
                                                                className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                                                                title={t('delete')}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
