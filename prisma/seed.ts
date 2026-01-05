import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({ log: ["info"] });

async function main() {
    const password = await bcrypt.hash("Ahmet+4545", 10);

    const admin = await prisma.user.upsert({
        where: { username: "ahmet.mersin@se.com" },
        update: {},
        create: {
            username: "ahmet.mersin@se.com",
            password,
            name: "Ahmet Mersin",
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
