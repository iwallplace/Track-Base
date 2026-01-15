import { prisma } from '@/lib/db';
import ReportsView from './reports-view';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";

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
    // console.log("ReportsPage: Starting...");
    try {
        const session = await getServerSession(authOptions);
        if (!session) redirect("/login");

        // RBAC: reports.view dinamik izin kontrolü
        const canViewReports = await hasPermission(session.user.role || "USER", 'reports.view');
        if (!canViewReports) {
            return (
                <div className="flex h-[50vh] flex-col items-center justify-center text-center">
                    <h2 className="text-2xl font-bold text-white">Erişim Reddedildi</h2>
                    <p className="text-gray-400">Raporları görüntüleme yetkiniz bulunmamaktadır.</p>
                </div>
            );
        }

        const params = await searchParams;

        // 1. Date Filter (for Activity Charts only)
        // Global KPIs (Stock, Dead Stock, Critical) should reflect the CURRENT state of the warehouse,
        // regardless of the selected date filter, unless specifically asked otherwise.
        // However, for consistency with standard dashboard behavior, if a user filters "Last Month",
        // they might expect "Transactions in Last Month".
        // BUT "Critical Stock" (Low Stock) is a state, not a history. "Dead Stock" is a state.
        // So we will calculate STATE -> Global, FLOW -> Filtered.

        let periodStart: Date | null = null;
        let periodEnd: Date | null = null;
        let period = "Tüm Zamanlar";

        if (params.startDate && params.endDate) {
            periodStart = new Date(params.startDate + 'T00:00:00');
            periodEnd = new Date(params.endDate + 'T23:59:59');
            period = `${params.startDate} - ${params.endDate}`;
        } else if (params.period) {
            period = params.period;
            const dateRange = getDateRangeFromPeriod(period);
            periodStart = dateRange.start;
            periodEnd = dateRange.end;
        }

        const dateFilter = periodStart && periodEnd ? {
            createdAt: { gte: periodStart, lte: periodEnd }
        } : {};

        // 2. Fetch ALL Data for accurate Stock Calculation (Snapshot)
        // We need full history to calculate current balance of any material.
        const allHistory = await prisma.inventoryItem.findMany({
            where: {
                deletedAt: null
            },
            select: {
                id: true,
                materialReference: true,
                stockCount: true,
                lastAction: true,
                date: true,
                createdAt: true,
                company: true
            },
            orderBy: { date: 'asc' }
        });

        // 3. Process Data In-Memory
        // Group by Material Reference to find current status
        const materialMap = new Map<string, {
            balance: number;
            totalEntry: number;
            totalExit: number;
            lastActivity: Date;
            company: string;
        }>();

        allHistory.forEach(item => {
            const ref = item.materialReference; // Normalized by Zod/Backend already

            if (!materialMap.has(ref)) {
                materialMap.set(ref, {
                    balance: 0,
                    totalEntry: 0,
                    totalExit: 0,
                    lastActivity: item.date,
                    company: item.company || ''
                });
            }

            const mat = materialMap.get(ref)!;

            if (item.lastAction === 'Giriş') {
                mat.balance += item.stockCount;
                mat.totalEntry += item.stockCount;
            } else if (item.lastAction === 'Çıkış') {
                mat.balance -= item.stockCount;
                mat.totalExit += item.stockCount;
            }

            if (item.date > mat.lastActivity) {
                mat.lastActivity = item.date;
            }
        });

        // 4. Calculate Global Metrics (Snapshot)
        // Fetch Material Limits
        // Fetch Material Limits
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const materials = await (prisma as any).material.findMany();
        const materialLimits = new Map<string, number>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        materials.forEach((m: any) => materialLimits.set(m.reference, m.minStock));

        let totalStock = 0;
        let totalExitsGlobal = 0;
        let lowStockCount = 0;
        let deadStockCount = 0;
        const lowStockList: any[] = [];
        const deadStockList: any[] = [];


        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        materialMap.forEach((data, ref) => {
            // Prevent negative stock artifacts in calculation
            const safeBalance = Math.max(0, data.balance);
            const limit = materialLimits.get(ref) ?? 20;

            totalStock += safeBalance;
            totalExitsGlobal += data.totalExit;

            if (safeBalance <= limit) { // safeBalance > 0 removed to show 0 stock as critical if limit > 0
                lowStockCount++;
                lowStockList.push({
                    id: ref, // using ref as id for list
                    materialReference: ref,
                    company: data.company,
                    stockCount: safeBalance,
                    limit: limit
                });
            }

            if (safeBalance > 0 && data.lastActivity < ninetyDaysAgo) {
                deadStockCount++;
                deadStockList.push({
                    id: ref,
                    materialReference: ref,
                    company: data.company,
                    stockCount: safeBalance,
                    lastActivity: data.lastActivity
                });
            }
        });

        // Prepare Top Materials (By Transaction Volume - Filtered or Global? Usually Global or Filtered context)
        // Let's use Filtered context for "Top Movers in this Period"
        const filteredItems = (periodStart && periodEnd)
            ? allHistory.filter(i => i.createdAt >= periodStart! && i.createdAt <= periodEnd!)
            : allHistory;

        // 5. Chart Data (Activity over time - Filtered)
        const statusCountsMap = { 'Giriş': 0, 'Çıkış': 0 };
        const monthlyActivityMap = new Map<number, { entry: number; exit: number }>();

        filteredItems.forEach(item => {
            // Status Counts
            if (item.lastAction === 'Giriş') statusCountsMap['Giriş']++;
            if (item.lastAction === 'Çıkış') statusCountsMap['Çıkış']++;

            // Monthly Activity
            const month = new Date(item.date).getMonth() + 1; // 1-12
            if (!monthlyActivityMap.has(month)) {
                monthlyActivityMap.set(month, { entry: 0, exit: 0 });
            }
            const mData = monthlyActivityMap.get(month)!;
            if (item.lastAction === 'Giriş') mData.entry += item.stockCount;
            if (item.lastAction === 'Çıkış') mData.exit += item.stockCount;
        });

        const statusCounts = [
            { name: 'Giriş', value: statusCountsMap['Giriş'] },
            { name: 'Çıkış', value: statusCountsMap['Çıkış'] }
        ];

        const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
        const monthlyActivity = Array.from(monthlyActivityMap.entries())
            .map(([monthNum, counts]) => ({
                name: monthNames[monthNum - 1] || `Ay ${monthNum}`,
                entry: counts.entry,
                exit: counts.exit,
            }))
            .sort((a, b) => monthNames.indexOf(a.name) - monthNames.indexOf(b.name));


        // 6. Turnover Rate
        // Logic: (Total Exits / Current Total Stock) * 100
        // Use global values for specific "Stock Turnover" snapshot
        const turnoverRate = totalStock > 0
            ? ((totalExitsGlobal / totalStock) * 100).toFixed(1)
            : "0.0";


        // 7. Top Materials (Filtered by Date Range - showing movement volume)
        const topMatMap = new Map<string, { count: number, stockSum: number }>();
        filteredItems.forEach(item => {
            if (!topMatMap.has(item.materialReference)) {
                topMatMap.set(item.materialReference, { count: 0, stockSum: 0 });
            }
            const tm = topMatMap.get(item.materialReference)!;
            tm.count++;
            tm.stockSum += item.stockCount;
        });

        const topMaterials = Array.from(topMatMap.entries())
            .map(([ref, val]) => ({
                reference: ref,
                transactionCount: val.count,
                totalStock: val.stockSum // This is volume moved, not balance
            }))
            .sort((a, b) => b.transactionCount - a.transactionCount)
            .slice(0, 5);


        // 9. System Metrics (RBAC Controlled)
        let systemMetrics = undefined;

        // Check permission
        const hasSystemStatusPermission = await prisma.rolePermission.findUnique({
            where: {
                role_permission: {
                    role: session.user.role as string,
                    permission: 'system.status.view'
                }
            }
        });

        // ADMIN always sees it, or if permission is explicitly granted
        if (session.user.role === 'ADMIN' || (hasSystemStatusPermission && hasSystemStatusPermission.granted)) {
            try {
                // DB Size
                const dbSizeResult = await prisma.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) as size`;
                const dbSize = Array.isArray(dbSizeResult) && dbSizeResult.length > 0 ? (dbSizeResult[0] as any).size : 'Unknown';

                // Row Count
                const rowCount = await prisma.inventoryItem.count();

                // Memory (Heap Used)
                const used = process.memoryUsage().heapUsed / 1024 / 1024;
                const memoryUsage = `${Math.round(used)} MB`;

                // Platform
                const platform = `${process.platform} (${process.arch}) - Node ${process.version}`;

                systemMetrics = {
                    dbSize: dbSize as string,
                    memoryUsage,
                    uptime: Math.floor(process.uptime()),
                    platform,
                    rowCount
                };
            } catch (err) {
                console.error("System Metrics Fetch Error:", err);
                // Fail silently for system metrics
            }
        }

        const data = {
            statusCounts,
            monthlyActivity,
            totalStock, // Real current balance (Quantity) - kept for internal logic/charts if needed
            uniqueMaterialCount: materialMap.size, // NEW: Distinct Material Reference Count
            turnoverRate, // Real turnover based on 'Çıkış'
            deadStockCount, // Real dead stock (>90 days inactivity)
            lowStockCount, // Real critical stock (<20 balance)
            lowStockItems: lowStockList.slice(0, 5), // Top 5 critical items (for preview list)
            allLowStockItems: lowStockList, // Full list for Modal
            deadStockItems: deadStockList, // Full list for Modal
            topMaterials,
            systemMetrics
        };

        // console.log("ReportsPage: Data calculated successfully.");

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

