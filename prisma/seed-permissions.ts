import { prisma } from '../lib/db';

// Default permission configuration
const PERMISSIONS = [
    'data.view',
    'inventory.create',
    'inventory.delete',
    'users.create',
    'users.delete',
    'users.role.change',
    'settings.edit',
    'ai.use',
    'reports.view'
];

// Default permissions per role
const DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
    ADMIN: {
        'data.view': true,
        'inventory.create': true,
        'inventory.delete': true,
        'users.create': true,
        'users.delete': true,
        'users.role.change': true,
        'settings.edit': true,
        'ai.use': true,
        'reports.view': true,
    },
    IME: {
        'data.view': true,
        'inventory.create': true,
        'inventory.delete': false,
        'users.create': true,
        'users.delete': true,
        'users.role.change': false,
        'settings.edit': false,
        'ai.use': true,
        'reports.view': true,
    },
    KALITE: {
        'data.view': true,
        'inventory.create': true,
        'inventory.delete': false,
        'users.create': true,
        'users.delete': true,
        'users.role.change': false,
        'settings.edit': false,
        'ai.use': true,
        'reports.view': true,
    },
    USER: {
        'data.view': true,
        'inventory.create': true,
        'inventory.delete': false,
        'users.create': false,
        'users.delete': false,
        'users.role.change': false,
        'settings.edit': false,
        'ai.use': true,
        'reports.view': true,
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
