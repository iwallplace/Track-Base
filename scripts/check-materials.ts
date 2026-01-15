
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const count = await prisma.material.count();
    console.log(`Total Materials: ${count}`);
    if (count > 0) {
        const first = await prisma.material.findFirst();
        console.log('Sample Material:', first);
    } else {
        console.log('No materials found. You might need to seed some.');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
