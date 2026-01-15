// Seed script to add 50 test inventory items
// Run with: npx ts-node scripts/seed-test-data.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const companies = ['ABC Makina', 'XYZ Endüstri', 'Mega Üretim', 'Turbo Tech', 'Sanayi Plus'];
const locations = ['Depo A', 'Depo B', 'Raf 1', 'Raf 2', 'Üretim Alanı', 'Sevkiyat'];
const materials = [
    'VIDA-M8X25', 'VIDA-M10X30', 'SOMUN-M8', 'SOMUN-M10', 'PULSOMUN-M8',
    'CIVATA-M12X40', 'RONDELA-10', 'RONDELA-12', 'PERNO-8X50', 'PERNO-10X60',
    'CONTA-DN50', 'CONTA-DN80', 'FILTRE-YAKIT', 'FILTRE-HAVA', 'FILTRE-YAG',
    'KAYIS-V10', 'KAYIS-V12', 'RULMAN-6205', 'RULMAN-6206', 'RULMAN-6207',
    'YATAKLIK-P205', 'YATAKLIK-P206', 'SAFT-30', 'SAFT-40', 'SAFT-50',
    'ELEKTROT-2.5', 'ELEKTROT-3.25', 'BORU-DN50', 'BORU-DN80', 'BORU-DN100',
    'VANA-DN50', 'VANA-DN80', 'POMPA-SUB1', 'POMPA-SUB2', 'MOTOR-0.75KW',
    'MOTOR-1.5KW', 'MOTOR-2.2KW', 'KABLO-1.5MM', 'KABLO-2.5MM', 'KABLO-4MM',
    'SIGORTA-10A', 'SIGORTA-16A', 'SIGORTA-25A', 'KONNEKTOR-ST', 'KONNEKTOR-LC',
    'SENSOR-TEMP', 'SENSOR-PRES', 'ENCODER-100', 'PLC-CPU', 'HMI-7INCH'
];

async function seedTestData() {
    console.log('🗑️ Deleting existing inventory items...');

    // Delete all existing inventory items
    const deleted = await prisma.inventoryItem.deleteMany({});
    console.log(`   Deleted ${deleted.count} existing records`);

    console.log('\n📦 Creating 50 test inventory items...');

    const now = new Date();
    const testItems = [];

    for (let i = 0; i < 50; i++) {
        const material = materials[i % materials.length];
        const company = companies[Math.floor(Math.random() * companies.length)];
        const location = locations[Math.floor(Math.random() * locations.length)];
        const stockCount = Math.floor(Math.random() * 100) + 1;
        const isEntry = Math.random() > 0.3; // 70% entries, 30% exits

        // Random date in last 30 days
        const daysAgo = Math.floor(Math.random() * 30);
        const itemDate = new Date(now);
        itemDate.setDate(itemDate.getDate() - daysAgo);

        const year = itemDate.getFullYear();
        const month = itemDate.getMonth() + 1;
        const week = Math.ceil((itemDate.getDate() + 6 - itemDate.getDay()) / 7);

        testItems.push({
            year,
            month,
            week,
            date: itemDate,
            company,
            waybillNo: `IRF-${2024}${String(i + 1).padStart(4, '0')}`,
            materialReference: material,
            stockCount,
            lastAction: isEntry ? 'Giriş' : 'Çıkış',
            location,
            note: `Test verisi #${i + 1}`,
            createdAt: itemDate
        });
    }

    // Create items
    for (const item of testItems) {
        await prisma.inventoryItem.create({ data: item });
        process.stdout.write('.');
    }

    console.log('\n\n✅ Created 50 test inventory items successfully!');

    // Summary
    const summary = await prisma.inventoryItem.groupBy({
        by: ['lastAction'],
        _count: true,
        _sum: { stockCount: true }
    });

    console.log('\n📊 Summary:');
    summary.forEach(s => {
        console.log(`   ${s.lastAction}: ${s._count} records, ${s._sum.stockCount} units`);
    });
}

seedTestData()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
