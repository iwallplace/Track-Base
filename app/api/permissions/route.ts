import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/db";
import {
    successResponse,
    errorResponse,
    unauthorizedResponse,
    forbiddenResponse,
    internalErrorResponse,
    devError
} from "@/lib/api-response";

// Permission labels for UI - 17 izin
const PERMISSION_LABELS: Record<string, string> = {
    // Veri Erişimi
    'data.view': 'Tüm verileri görüntüleme',

    // Envanter İzinleri
    'inventory.view': 'Envanter listesini görme',
    'inventory.create': 'Envanter kaydı ekleme',
    'inventory.delete': 'Envanter kaydı silme',
    'inventory.export': 'Excel export',

    // Kullanıcı Yönetimi
    'users.view': 'Kullanıcı listesini görme',
    'users.create': 'Kullanıcı ekleme',
    'users.edit': 'Kullanıcı düzenleme',
    'users.delete': 'Kullanıcı silme',
    'users.role.change': 'Kullanıcı rolü değiştirme',

    // Sistem Ayarları
    'settings.view': 'Ayarları görüntüleme',
    'settings.edit': 'Profil düzenleme',

    // Özellikler
    'ai.use': 'AI asistanını kullanma',
    'reports.view': 'Raporları görüntüleme',
    'audit.view': 'Sistem kayıtlarını görme',
    'notifications.view': 'Bildirimleri görme',
    'system.status.view': 'Sistem durumunu görüntüleme'
};

const ROLE_LABELS: Record<string, string> = {
    'ADMIN': 'Project Owner',
    'IME': 'IME',
    'KALITE': 'Kalite',
    'USER': 'İnci Personeli'
};

// Protected permissions that ADMIN cannot remove from themselves
const PROTECTED_ADMIN_PERMISSIONS = ['data.view', 'users.role.change', 'settings.edit'];

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) return unauthorizedResponse();

    try {
        const permissions = await prisma.rolePermission.findMany({
            orderBy: [{ role: 'asc' }, { permission: 'asc' }]
        });

        // Group by role
        const grouped: Record<string, Record<string, boolean>> = {};

        for (const p of permissions) {
            if (!grouped[p.role]) grouped[p.role] = {};
            // Force ADMIN to always be true in UI to match backend logic
            if (p.role === 'ADMIN') {
                grouped[p.role][p.permission] = true;
            } else {
                grouped[p.role][p.permission] = p.granted;
            }
        }

        // Ensure all known permissions are present for ADMIN as true even if missing in DB
        if (!grouped['ADMIN']) grouped['ADMIN'] = {};
        for (const key of Object.keys(PERMISSION_LABELS)) {
            grouped['ADMIN'][key] = true;
        }

        return successResponse({
            permissions: grouped,
            labels: PERMISSION_LABELS,
            roleLabels: ROLE_LABELS
        });
    } catch (error) {
        devError("Permissions GET Error:", error);
        return internalErrorResponse();
    }
}

export async function PUT(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return unauthorizedResponse();

    // Only ADMIN can modify permissions
    if (session.user.role !== 'ADMIN') {
        return forbiddenResponse("Sadece Project Owner yetkileri değiştirebilir");
    }

    try {
        const body = await req.json();
        const { role, permission, granted } = body;

        if (!role || !permission || typeof granted !== 'boolean') {
            return errorResponse("role, permission ve granted alanları gerekli", 400);
        }

        // Protect ADMIN from self-lockout
        if (role === 'ADMIN' && PROTECTED_ADMIN_PERMISSIONS.includes(permission) && !granted) {
            return errorResponse("Bu yetki ADMIN için kaldırılamaz (kilitlenme riski)", 403);
        }

        // Upsert the permission
        const updated = await prisma.rolePermission.upsert({
            where: {
                role_permission: { role, permission }
            },
            update: { granted },
            create: { role, permission, granted }
        });

        // Invalidate permission cache so changes take effect immediately
        const { invalidatePermissionCache } = await import("@/lib/permissions");
        invalidatePermissionCache();

        return successResponse(updated, "Yetki güncellendi");
    } catch (error) {
        devError("Permissions PUT Error:", error);
        return internalErrorResponse();
    }
}
