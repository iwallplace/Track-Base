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

    // --- MOCK DATA GENERATION ---
    console.log("Generating 50 References with 10 Transactions each...");
    const companies = ["Schneider Electric", "Siemens", "ABB", "Legrand", "Eaton", "Viko", "Oymapınar", "Arçelik", "Vestel", "Tofaş"];
    const statuses = ["Paketlendi", "Beklemede", "Sevk Edildi", "İade", "Üretim"];
    const mockData = [];

    for (let i = 1; i <= 50; i++) {
        const refCode = `REF-${1000 + i}`; // REF-1001, REF-1002...

        for (let j = 0; j < 10; j++) {
            const randomMonth = Math.floor(Math.random() * 12);
            const randomDay = Math.floor(Math.random() * 28) + 1;
            const date = new Date(2024, randomMonth, randomDay);

            mockData.push({
                year: 2024,
                month: randomMonth + 1,
                week: Math.ceil(randomDay / 7),
                date: date,
                company: companies[Math.floor(Math.random() * companies.length)],
                waybillNo: `IRS-2024-${Math.floor(Math.random() * 10000)}`,
                materialReference: refCode,
                stockCount: Math.floor(Math.random() * 500) + 10,
                lastAction: statuses[Math.floor(Math.random() * statuses.length)],
                note: `Otomatik test verisi ${i}-${j}`,
                lastModifiedBy: admin.id
            });
        }
    }

    // SQLite doesn't support createMany in older Prisma versions, but we are on standard usage. 
    // Usually reliable, but let's do a loop or createMany if supported.
    // Given the task, let's use a loop for safety or batches.

    // Batch Insert
    for (const item of mockData) {
        await prisma.inventoryItem.create({ data: item });
    }

    console.log(`Successfully created ${mockData.length} mock inventory records.`);
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
