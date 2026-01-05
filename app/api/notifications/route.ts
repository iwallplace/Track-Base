
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        // 1. Low Stock Notifications (For all users or just authorized? Usually everyone needs to know stock issues, or maybe just warehouse staff. Let's keep it for all for now)
        const lowStockItems = await prisma.inventoryItem.findMany({
            where: {
                stockCount: {
                    lt: 20,
                    gt: 0
                }
            },
            select: {
                id: true,
                materialReference: true,
                stockCount: true,
                company: true,
                updatedAt: true
            },
            orderBy: {
                stockCount: 'asc'
            },
            take: 10
        });

        const notifications: Array<{
            type: 'low_stock' | 'new_user';
            id: string;
            title: string;
            message: string;
            meta: any;
            link: string;
            date: Date;
        }> = lowStockItems.map(item => ({
            type: 'low_stock',
            id: item.id,
            title: 'Kritik Stok Seviyesi',
            message: `${item.materialReference} referanslı ürün stoğu ${item.stockCount} adete düştü.`,
            meta: { company: item.company },
            link: `/dashboard/inventory/${item.id}`,
            date: item.updatedAt
        }));

        // 2. User Activity Notifications (Only for ADMIN, IME, KALITE)
        if (session.user.role && ['ADMIN', 'IME', 'KALITE'].includes(session.user.role)) {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const newUsers = await prisma.user.findMany({
                where: {
                    createdAt: { gte: twentyFourHoursAgo }
                },
                orderBy: { createdAt: 'desc' }
            });

            const userNotifications = newUsers.map(user => ({
                type: 'new_user' as const,
                id: user.id,
                title: 'Yeni Kullanıcı Katıldı',
                message: `${user.name} (${user.role}) sisteme eklendi.`,
                meta: { role: user.role },
                link: '/dashboard/companies',
                date: user.createdAt
            }));

            notifications.push(...userNotifications);
        }

        // Sort combined notifications by date desc
        notifications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return NextResponse.json(notifications);
    } catch (error) {
        console.error("Notifications Error:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
