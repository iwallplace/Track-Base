import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({ log: ["info"] });

async function main() {
    const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "Admin123!"; // Default unsafe password for development only

    const password = await bcrypt.hash(adminPassword, 10);

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
