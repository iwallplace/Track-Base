import { prisma } from '@/lib/db';
import ReportsView from './reports-view';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

// Helper function to get date range based on period
function getDateRangeFromPeriod(period: string): { start: Date | null; end: Date | null } {
    const now = new Date();
    const currentYear = now.getFullYear();

    switch (period) {
        case 'Bu Hafta': {
            const start = new Date(now);
            start.setDate(now.getDate() - now.getDay());
            start.setHours(0, 0, 0, 0);
            return { start, end: now };
        }
        case 'Geçen Hafta': {
            const end = new Date(now);
            end.setDate(now.getDate() - now.getDay());
            end.setHours(0, 0, 0, 0);
            const start = new Date(end);
            start.setDate(start.getDate() - 7);
            return { start, end };
        }
        case 'Bu Ay': {
            const start = new Date(currentYear, now.getMonth(), 1);
            return { start, end: now };
        }
        case 'Geçen Ay': {
            const start = new Date(currentYear, now.getMonth() - 1, 1);
            const end = new Date(currentYear, now.getMonth(), 0, 23, 59, 59);
            return { start, end };
        }
        case 'Q1': {
            return { start: new Date(currentYear, 0, 1), end: new Date(currentYear, 2, 31, 23, 59, 59) };
        }
        case 'Q2': {
            return { start: new Date(currentYear, 3, 1), end: new Date(currentYear, 5, 30, 23, 59, 59) };
        }
        case 'Q3': {
            return { start: new Date(currentYear, 6, 1), end: new Date(currentYear, 8, 30, 23, 59, 59) };
        }
        case 'Q4': {
            return { start: new Date(currentYear, 9, 1), end: new Date(currentYear, 11, 31, 23, 59, 59) };
        }
        case 'Bu Yıl': {
            return { start: new Date(currentYear, 0, 1), end: now };
        }
        case 'Geçen Yıl': {
            return { start: new Date(currentYear - 1, 0, 1), end: new Date(currentYear - 1, 11, 31, 23, 59, 59) };
        }
        default:
            return { start: null, end: null }; // Tüm Zamanlar
    }
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ startDate?: string; endDate?: string; period?: string }> }) {
    console.log("ReportsPage: Starting...");
    try {
        const session = await getServerSession(authOptions);
        console.log("ReportsPage: Session Check", session ? "Found" : "Null");

        const params = await searchParams;

        // Support both new startDate/endDate format and legacy period format
        let periodStart: Date | null = null;
        let periodEnd: Date | null = null;
        let period = "Tüm Zamanlar";

        if (params.startDate && params.endDate) {
            // New format from DateRangePicker
            periodStart = new Date(params.startDate + 'T00:00:00');
            periodEnd = new Date(params.endDate + 'T23:59:59');
            period = `${params.startDate} - ${params.endDate}`;
        } else if (params.period) {
            // Legacy format
            period = params.period;
            const dateRange = getDateRangeFromPeriod(period);
            periodStart = dateRange.start;
            periodEnd = dateRange.end;
        }

        console.log("ReportsPage: Date Range", periodStart, periodEnd);

        if (!session) {
            redirect("/login");
        }

        if (session.user.role === 'USER') {
            return (
                <div className="flex h-[50vh] flex-col items-center justify-center text-center">
                    <h2 className="text-2xl font-bold text-white">Erişim Reddedildi</h2>
                    <p className="text-gray-400">Raporları görüntüleme yetkiniz bulunmamaktadır.</p>
                </div>
            );
        }

        // Get date range for filtering
        const dateFilter = periodStart && periodEnd ? {
            createdAt: { gte: periodStart, lte: periodEnd }
        } : {};



        // 2. Status Aggregation
        console.log("ReportsPage: Fetching Status Counts...");
        const statusCountsRaw = await prisma.inventoryItem.groupBy({
            by: ['lastAction'],
            _count: { _all: true },
            where: dateFilter
        });

        const statusCounts = statusCountsRaw.map(item => ({
            name: item.lastAction,
            value: item._count._all,
        }));

        // 3. Monthly Activity (filtered by date range)
        console.log("ReportsPage: Fetching Monthly Activity...");
        const allItems = await prisma.inventoryItem.findMany({
            select: {
                month: true,
                stockCount: true,
                lastAction: true,
            },
            where: dateFilter,
            orderBy: { date: 'asc' }
        });

        const monthlyMap = new Map<number, { entry: number; exit: number }>();
        allItems.forEach(item => {
            const month = item.month;
            if (!monthlyMap.has(month)) {
                monthlyMap.set(month, { entry: 0, exit: 0 });
            }
            const current = monthlyMap.get(month)!;
            if (item.lastAction === 'Sevk Edildi') {
                current.exit += item.stockCount;
            } else {
                current.entry += item.stockCount;
            }
        });

        const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

        const monthlyActivity = Array.from(monthlyMap.entries())
            .map(([monthNum, counts]) => ({
                name: monthNames[monthNum - 1] || `Ay ${monthNum}`,
                entry: counts.entry,
                exit: counts.exit,
            }))
            .sort((a, b) => monthNames.indexOf(a.name) - monthNames.indexOf(b.name));

        // 4. Summary Metrics (filtered by date range)
        console.log("ReportsPage: Fetching Summary Metrics...");
        const totalStockAgg = await prisma.inventoryItem.aggregate({
            _sum: { stockCount: true },
            where: dateFilter
        });
        const totalStock = totalStockAgg._sum.stockCount || 0;



        // 5. Enterprise-Level Advanced Metrics
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const deadStockCount = await prisma.inventoryItem.count({
            where: { updatedAt: { lt: ninetyDaysAgo }, stockCount: { gt: 0 } }
        });

        const lowStockCount = await prisma.inventoryItem.count({
            where: { stockCount: { lt: 20, gt: 0 } }
        });

        const totalExitsAgg = await prisma.inventoryItem.aggregate({
            _sum: { stockCount: true },
            where: { lastAction: 'Sevk Edildi' }
        });
        const totalExits = totalExitsAgg._sum.stockCount || 0;
        const turnoverRate = totalStock > 0 ? ((totalExits / totalStock) * 100).toFixed(1) : "0.0";

        // 8. Stok Uyarıları (Low Stock Items)
        const lowStockItems = await prisma.inventoryItem.findMany({
            where: {
                stockCount: { lt: 20, gt: 0 },
                ...dateFilter
            },
            take: 5,
            orderBy: { stockCount: 'asc' },
            select: {
                id: true,
                materialReference: true,
                company: true,
                stockCount: true
            }
        });



        // 10. En Hareketli Ürünler (by total transactions)
        const topMaterialsRaw = await prisma.inventoryItem.groupBy({
            by: ['materialReference'],
            _count: { _all: true },
            _sum: { stockCount: true },
            orderBy: { _count: { materialReference: 'desc' } },
            take: 5,
            where: dateFilter
        });
        const topMaterials = topMaterialsRaw.map(m => ({
            reference: m.materialReference,
            transactionCount: m._count._all,
            totalStock: m._sum.stockCount || 0
        }));

        const data = {
            statusCounts,
            monthlyActivity,
            totalStock,
            turnoverRate,
            deadStockCount,
            lowStockCount,
            lowStockItems,
            topMaterials
        };

        console.log("ReportsPage: Ready to render.");

        return <ReportsView data={data} period={period} />;

    } catch (error) {
        console.error("ReportsPage ERROR:", error);
        return (
            <div className="p-8 text-white">
                <h1 className="text-xl font-bold text-red-500">Bir hata oluştu</h1>
                <pre className="mt-4 p-4 bg-gray-900 rounded overflow-auto">
                    {JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}
                </pre>
            </div>
        );
    }
}

