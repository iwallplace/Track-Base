import { prisma } from '../lib/db';

// Default permission configuration - 17 izin
const PERMISSIONS = [
    // Veri Erişimi
    'data.view',
    // Envanter
    'inventory.view',
    'inventory.create',
    'inventory.delete',
    'inventory.export',
    // Kullanıcılar
    'users.view',
    'users.create',
    'users.edit',
    'users.delete',
    'users.role.change',
    // Ayarlar
    'settings.view',
    'settings.edit',
    // Özellikler
    'ai.use',
    'reports.view',
    'audit.view',
    'notifications.view',
    'system.status.view'
];

// Default permissions per role
const DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
    ADMIN: {
        'data.view': true,
        'inventory.view': true,
        'inventory.create': true,
        'inventory.delete': true,
        'inventory.export': true,
        'users.view': true,
        'users.create': true,
        'users.edit': true,
        'users.delete': true,
        'users.role.change': true,
        'settings.view': true,
        'settings.edit': true,
        'ai.use': true,
        'reports.view': true,
        'audit.view': true,
        'notifications.view': true,
        'system.status.view': true,
    },
    IME: {
        'data.view': true,
        'inventory.view': true,
        'inventory.create': true,
        'inventory.delete': false,
        'inventory.export': true,
        'users.view': true,
        'users.create': true,
        'users.edit': true,
        'users.delete': true,
        'users.role.change': false,
        'settings.view': true,
        'settings.edit': true,
        'ai.use': true,
        'reports.view': true,
        'audit.view': false,
        'notifications.view': true,
        'system.status.view': false,
    },
    KALITE: {
        'data.view': true,
        'inventory.view': true,
        'inventory.create': true,
        'inventory.delete': false,
        'inventory.export': true,
        'users.view': true,
        'users.create': true,
        'users.edit': true,
        'users.delete': true,
        'users.role.change': false,
        'settings.view': true,
        'settings.edit': true,
        'ai.use': true,
        'reports.view': true,
        'audit.view': false,
        'notifications.view': true,
        'system.status.view': false,
    },
    USER: {
        'data.view': true,
        'inventory.view': true,
        'inventory.create': true,
        'inventory.delete': false,
        'inventory.export': true,
        'users.view': false,
        'users.create': false,
        'users.edit': false,
        'users.delete': false,
        'users.role.change': false,
        'settings.view': true,
        'settings.edit': true,
        'ai.use': true,
        'reports.view': false,
        'audit.view': false,
        'notifications.view': true,
        'system.status.view': false,
    }
};

async function seedPermissions() {
    console.log('🔐 Seeding role permissions...');

    for (const [role, permissions] of Object.entries(DEFAULT_PERMISSIONS)) {
        for (const [permission, granted] of Object.entries(permissions)) {
            await prisma.rolePermission.upsert({
                where: {
                    role_permission: { role, permission }
                },
                update: { granted },
                create: { role, permission, granted }
            });
        }
        console.log(`  ✓ ${role} permissions seeded`);
    }

    console.log('✅ All permissions seeded successfully!');
}

// Run if called directly
seedPermissions()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
