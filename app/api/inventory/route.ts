import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/db";
import { createInventoryItemSchema, validate } from "@/lib/validations";
import {
    successResponse,
    errorResponse,
    unauthorizedResponse,
    forbiddenResponse,
    validationErrorResponse,
    internalErrorResponse,
    devError
} from "@/lib/api-response";
import { hasPermission } from "@/lib/permissions";

interface InventorySummary {
    id: string;
    materialReference: string;
    company: string;
    waybillNo: string;
    date: Date;
    stockCount: number;
    lastAction: string;
    year: number;
    month: number;
    week: number;
    note: string;
    lastModifiedBy: string | null;
    modifierName?: string;
}

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return unauthorizedResponse();
    }

    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view');
    const page = parseInt(searchParams.get('page') || '1');
    const limitParam = searchParams.get('limit');
    const limit = limitParam === '-1' ? undefined : parseInt(limitParam || '50');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const dateFilter = searchParams.get('date') || '';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    try {
        const whereClause: any = {};

        if (search) {
            whereClause.OR = [
                { materialReference: { contains: search } },
                { company: { contains: search } },
                { waybillNo: { contains: search } }
            ];
        }

        if (status) {
            whereClause.lastAction = status;
        }

        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            whereClause.date = { gte: start, lte: end };
        } else if (dateFilter === 'this_week' && !search && view !== 'summary') {
            const now = new Date();
            const dayOfWeek = now.getDay();
            const diffToMonday = (dayOfWeek + 6) % 7;
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - diffToMonday);
            startOfWeek.setHours(0, 0, 0, 0);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);
            whereClause.date = { gte: startOfWeek, lte: endOfWeek };
        }

        if (view === 'summary') {
            // 1. Separate Status from WhereClause for initial fetch
            // We need to find materials that match Search/Date, then check their LATEST status
            const queryWhere = { ...whereClause };
            delete queryWhere.lastAction; // Remove status filter from DB query

            // 2. Find all distinct materials matching Search/Date
            const distinctMaterials = await prisma.inventoryItem.findMany({
                where: queryWhere,
                select: { materialReference: true },
                distinct: ['materialReference'],
                orderBy: { materialReference: 'asc' }
            });

            // 3. Process items to find Latest and Balance
            const processedItems: InventorySummary[] = [];

            for (const mat of distinctMaterials) {
                const ref = mat.materialReference;

                // Find Latest Item (matching Search/Date)
                const latestItem = await prisma.inventoryItem.findFirst({
                    where: { materialReference: ref, ...queryWhere },
                    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]
                });

                if (latestItem) {
                    // 4. Apply Status Filter here (on the LATEST item)
                    if (status && latestItem.lastAction !== status) {
                        continue; // Skip if latest status doesn't match filter
                    }

                    // Calculate Global Balance (Always global for accuracy)
                    // Note: If view assumes "Balance at date", this should be adjusted.
                    // But current UI implies "Current Stock" vs "History".
                    // The previous code calculated global balance. Keeping it consistent.
                    const [entrySum, exitSum] = await Promise.all([
                        prisma.inventoryItem.aggregate({
                            _sum: { stockCount: true },
                            where: { materialReference: ref, lastAction: 'Giriş' }
                        }),
                        prisma.inventoryItem.aggregate({
                            _sum: { stockCount: true },
                            where: { materialReference: ref, lastAction: 'Çıkış' }
                        })
                    ]);

                    const balance = (entrySum._sum.stockCount || 0) - (exitSum._sum.stockCount || 0);

                    processedItems.push({
                        id: latestItem.id,
                        materialReference: ref,
                        company: latestItem.company || '',
                        waybillNo: latestItem.waybillNo,
                        date: latestItem.date,
                        stockCount: balance,
                        lastAction: latestItem.lastAction,
                        year: latestItem.year,
                        month: latestItem.month,
                        week: latestItem.week,
                        note: latestItem.note || '',
                        lastModifiedBy: latestItem.lastModifiedBy
                    });
                }
            }

            // 5. Paginate In-Memory
            const total = processedItems.length;
            const paginatedItems = limit
                ? processedItems.slice((page - 1) * limit, page * limit)
                : processedItems;

            // 6. Map Users
            const userIds = [...new Set(paginatedItems.map(i => i.lastModifiedBy).filter(Boolean) as string[])];
            const users = await prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, name: true }
            });
            const userMap = new Map(users.map(u => [u.id, u.name]));

            const finalItems = paginatedItems.map(item => ({
                ...item,
                modifierName: item.lastModifiedBy ? userMap.get(item.lastModifiedBy) || 'Bilinmeyen' : 'Sistem'
            }));

            return successResponse({
                items: finalItems,
                pagination: {
                    total,
                    page,
                    limit: limit || total,
                    totalPages: limit ? Math.ceil(total / limit) : 1
                }
            });
        }

        const [inventory, total] = await prisma.$transaction([
            prisma.inventoryItem.findMany({
                where: whereClause,
                orderBy: { createdAt: "desc" },
                skip: limit ? (page - 1) * limit : undefined,
                take: limit,
            }),
            prisma.inventoryItem.count({ where: whereClause })
        ]);

        const userIds = [...new Set(inventory.map(i => i.lastModifiedBy).filter(Boolean) as string[])];
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true }
        });

        const userMap = new Map(users.map(u => [u.id, u.name]));

        const enrichedInventory = inventory.map(item => ({
            ...item,
            modifierName: item.lastModifiedBy ? userMap.get(item.lastModifiedBy) || 'Bilinmeyen' : 'Sistem'
        }));

        return successResponse({
            items: enrichedInventory,
            pagination: {
                total,
                page,
                limit: limit || total,
                totalPages: limit ? Math.ceil(total / limit) : 1
            }
        });
    } catch (error) {
        devError("Inventory GET Error:", error);
        return internalErrorResponse();
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();

        // Check Permissions (Fortress Level)
        // Check Permissions (Fortress Level)
        const hasCreatePermission = await hasPermission(session.user.role || "USER", 'inventory.create');
        if (!hasCreatePermission) {
            console.warn(`[SECURITY] Unauthorized inventory creation attempt by user: ${session.user.id} (${session.user.role})`);
            return forbiddenResponse("Bu işlem için yetkiniz yok (Envanter kaydı ekleme)");
        }

        // Zod validation handles uppercase transformation automatically now
        const validation = validate(createInventoryItemSchema, body);
        if (!validation.success) {
            return validationErrorResponse(validation.error);
        }

        const data = validation.data;

        // Calculate Date parts for Europe/Istanbul
        const now = new Date();
        const dateFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Europe/Istanbul',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
        });

        const parts = dateFormatter.formatToParts(now);
        const year = parseInt(parts.find(p => p.type === 'year')?.value || String(now.getFullYear()));
        const month = parseInt(parts.find(p => p.type === 'month')?.value || String(now.getMonth() + 1));
        const day = parseInt(parts.find(p => p.type === 'day')?.value || String(now.getDate()));

        // Construct date object (noon to avoid timezone shifting issues on display if possible, or just strict date)
        const date = new Date(year, month - 1, day);

        // Simple ISO week calculation
        const target = new Date(year, month - 1, day);
        const dayNr = (target.getDay() + 6) % 7;
        target.setDate(target.getDate() - dayNr + 3);
        const firstThursday = target.valueOf();
        target.setMonth(0, 1);
        if (target.getDay() !== 4) {
            target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
        }
        const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);

        // Check stock availability for Exit actions
        if (data.lastAction === 'Çıkış') {
            const totals = await prisma.inventoryItem.groupBy({
                by: ['lastAction'],
                where: {
                    materialReference: data.materialReference
                },
                _sum: {
                    stockCount: true
                }
            });

            let totalEntry = 0;
            let totalExit = 0;

            totals.forEach(t => {
                if (t.lastAction === 'Giriş') totalEntry += t._sum.stockCount || 0;
                if (t.lastAction === 'Çıkış') totalExit += t._sum.stockCount || 0;
            });

            const currentStock = totalEntry - totalExit;

            if (currentStock < data.stockCount) {
                console.warn(`[AUDIT] Failed Exit: Insufficient stock for ${data.materialReference}. Requested: ${data.stockCount}, Available: ${currentStock}`);
                return errorResponse(`Yetersiz Stok! Mevcut stok: ${currentStock}, Çıkış istenen: ${data.stockCount}`);
            }
        }

        const item = await prisma.inventoryItem.create({
            data: {
                year: year,
                month: month,
                week: week,
                date: date,
                company: data.company || "",
                waybillNo: data.waybillNo || "",
                materialReference: data.materialReference,
                stockCount: data.stockCount,
                lastAction: data.lastAction || "Giriş",
                note: data.note || "",
                lastModifiedBy: session.user.id
            }
        });

        // Audit Log
        console.log(`[AUDIT] Inventory Action (${data.lastAction}): ${data.materialReference} | Qt: ${data.stockCount} | User: ${session.user.name} (${session.user.id})`);

        return successResponse(item, "Envanter kaydı oluşturuldu");
    } catch (error) {
        devError("Inventory POST Error:", error);
        return internalErrorResponse();
    }
}

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session) return unauthorizedResponse();

    const hasDeletePermission = await hasPermission(session.user.role || "USER", 'inventory.delete');
    if (!hasDeletePermission) {
        return forbiddenResponse("Bu işlem için yetkiniz yok (Envanter kaydı silme)");
    }

    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return errorResponse("ID gerekli", 400);
        }

        await prisma.inventoryItem.delete({
            where: { id }
        });

        return successResponse(undefined, "Kayıt silindi");
    } catch (error) {
        devError("Inventory DELETE Error:", error);
        return internalErrorResponse();
    }
}
