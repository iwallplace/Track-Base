import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({ log: ["info"] });

async function main() {
    const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "Admin123!"; // Default unsafe password for development only

    const password = await bcrypt.hash(adminPassword, 10);

    // Seed Roles
    const roles = [
        { name: 'ADMIN', label: 'Project Owner', color: 'purple', isSystem: true },
        { name: 'USER', label: 'Kullanıcı', color: 'gray', isSystem: true },
        { name: 'IME', label: 'İnci Personeli', color: 'blue', isSystem: false },
        { name: 'KALITE', label: 'Kalite Kontrol', color: 'emerald', isSystem: false },
        { name: 'SCL', label: 'Tedarik Zinciri', color: 'orange', isSystem: false }
    ];

    for (const role of roles) {
        await prisma.role.upsert({
            where: { name: role.name },
            update: {
                label: role.label,
                color: role.color,
                isSystem: role.isSystem
            },
            create: role
        });
    }
    console.log("Roles seeded.");

    const admin = await prisma.user.upsert({
        where: { username: adminEmail },
        update: {},
        create: {
            username: adminEmail,
            password,
            name: "Project Owner",
            role: "ADMIN",
        },
    });

    console.log({ admin });

    // Existing inventory cleared.
    await prisma.inventoryItem.deleteMany({});
    console.log("Cleared existing inventory items.");

    console.log("Database seeded with Admin user only.");
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
