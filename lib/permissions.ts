import { prisma } from './db';

// In-memory cache for permissions (refreshed on demand)
let permissionCache: Map<string, Map<string, boolean>> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute cache

/**
 * Check if a role has a specific permission
 */
export async function hasPermission(role: string, permission: string): Promise<boolean> {
    // Protected permissions that ADMIN always has
    // Protected permissions that ADMIN always has
    // Project Owner (ADMIN) should have access to everything effectively
    if (role === 'ADMIN') return true;

    /* Previous restricted check
    const PROTECTED = ['data.view', 'users.role.change', 'settings.edit'];
    if (role === 'ADMIN' && PROTECTED.includes(permission)) return true;
    */

    try {
        // Check cache first
        if (permissionCache && Date.now() - cacheTimestamp < CACHE_TTL) {
            const rolePerms = permissionCache.get(role);
            if (rolePerms) {
                const granted = rolePerms.get(permission);
                if (granted !== undefined) return granted;
            }
        }

        // Query database
        const perm = await prisma.rolePermission.findUnique({
            where: {
                role_permission: { role, permission }
            }
        });

        return perm?.granted ?? false;
    } catch (error) {
        console.error('Permission check error:', error);
        // Fail closed - deny access on error
        return false;
    }
}

/**
 * Get all permissions for a role
 */
export async function getRolePermissions(role: string): Promise<Record<string, boolean>> {
    try {
        const permissions = await prisma.rolePermission.findMany({
            where: { role }
        });

        const result: Record<string, boolean> = {};
        for (const p of permissions) {
            result[p.permission] = p.granted;
        }

        return result;
    } catch (error) {
        console.error('Get role permissions error:', error);
        return {};
    }
}

/**
 * Refresh the permission cache
 */
export async function refreshPermissionCache(): Promise<void> {
    try {
        const allPermissions = await prisma.rolePermission.findMany();

        permissionCache = new Map();

        for (const p of allPermissions) {
            if (!permissionCache.has(p.role)) {
                permissionCache.set(p.role, new Map());
            }
            permissionCache.get(p.role)!.set(p.permission, p.granted);
        }

        cacheTimestamp = Date.now();
    } catch (error) {
        console.error('Cache refresh error:', error);
    }
}

/**
 * Invalidate the permission cache (call after updates)
 */
export function invalidatePermissionCache(): void {
    permissionCache = null;
    cacheTimestamp = 0;
}
