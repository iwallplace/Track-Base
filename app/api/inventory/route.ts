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
import { createAuditLog } from "@/lib/audit";

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

    // New: Show Deleted Toggle
    const showDeleted = searchParams.get('showDeleted') === 'true';

    try {
        const baseWhere: any = {};

        // Base Filter: Handle Soft Delete Logic
        if (showDeleted) {
            // Permission Check for viewing deleted items
            if (session.user.role !== 'ADMIN') {
                // Non-admins cannot see deleted items even if they ask
                baseWhere.deletedAt = null;
            } else {
                // Admin asked for deleted items: Show deleted items
                baseWhere.deletedAt = { not: null };
            }
        } else {
            // Default behavior: Hide deleted
            baseWhere.deletedAt = null;
        }

        if (search) {
            baseWhere.OR = [
                { materialReference: { contains: search } },
                { company: { contains: search } },
                { waybillNo: { contains: search } }
            ];
        }

        if (status) {
            baseWhere.lastAction = status;
        }

        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            baseWhere.date = { gte: start, lte: end };
        } else if (dateFilter === 'this_week' && !search && view !== 'summary' && !showDeleted) {
            const now = new Date();
            const dayOfWeek = now.getDay();
            const diffToMonday = (dayOfWeek + 6) % 7;
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - diffToMonday);
            startOfWeek.setHours(0, 0, 0, 0);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);
            baseWhere.date = { gte: startOfWeek, lte: endOfWeek };
        }

        if (view === 'summary' && !showDeleted) {
            // 1. Separate Status from baseWhere for initial fetch
            const queryWhere = { ...baseWhere };
            delete queryWhere.lastAction;

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
                        continue;
                    }

                    // Calculate Global Balance
                    const [entrySum, exitSum] = await Promise.all([
                        prisma.inventoryItem.aggregate({
                            _sum: { stockCount: true },
                            where: { materialReference: ref, lastAction: 'Giriş', deletedAt: null }
                        }),
                        prisma.inventoryItem.aggregate({
                            _sum: { stockCount: true },
                            where: { materialReference: ref, lastAction: 'Çıkış', deletedAt: null }
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

        // Standard List View (Raw Data)
        const [inventory, total] = await prisma.$transaction([
            prisma.inventoryItem.findMany({
                where: baseWhere,
                orderBy: { createdAt: "desc" },
                skip: limit ? (page - 1) * limit : undefined,
                take: limit,
            }),
            prisma.inventoryItem.count({ where: baseWhere })
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

        // TRANSACTIONAL WRITE (Critical Section)
        const item = await prisma.$transaction(async (tx) => {
            // 1. Concurrency Check: Calculate stock within transaction
            if (data.lastAction === 'Çıkış') {
                const totals = await tx.inventoryItem.groupBy({
                    by: ['lastAction'],
                    where: {
                        materialReference: data.materialReference,
                        deletedAt: null
                    },
                    _sum: { stockCount: true }
                });

                let totalEntry = 0;
                let totalExit = 0;

                totals.forEach(t => {
                    if (t.lastAction === 'Giriş') totalEntry += t._sum.stockCount || 0;
                    if (t.lastAction === 'Çıkış') totalExit += t._sum.stockCount || 0;
                });

                const currentStock = totalEntry - totalExit;

                if (currentStock < data.stockCount) {
                    throw new Error(`INSUFFICIENT_STOCK:${currentStock}:${data.stockCount}`);
                }
            }

            // 2. Create the Item
            const createdItem = await tx.inventoryItem.create({
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

            // 3. Create Audit Log (Atomic with Item Creation)
            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    action: "CREATE",
                    entity: "INVENTORY",
                    entityId: createdItem.id,
                    details: JSON.stringify({ materialReference: data.materialReference, stockCount: data.stockCount, action: data.lastAction })
                }
            });

            return createdItem;
        });

        return successResponse(item, "Envanter kaydı oluşturuldu");
    } catch (error: any) {
        if (error.message?.startsWith('INSUFFICIENT_STOCK')) {
            const [_, checkStock, checkRequested] = error.message.split(':');
            return errorResponse(`Yetersiz Stok! Mevcut stok: ${checkStock}, Çıkış istenen: ${checkRequested}`);
        }
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

        // TRANSACTIONAL SOFT DELETE
        await prisma.$transaction(async (tx) => {
            // 1. Soft Delete
            await tx.inventoryItem.update({
                where: { id },
                data: { deletedAt: new Date() }
            });

            // 2. Audit Log
            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    action: "DELETE (SOFT)",
                    entity: "INVENTORY",
                    entityId: id,
                    details: JSON.stringify({ id })
                }
            });
        });

        return successResponse(undefined, "Kayıt silindi (Arşivlendi)");
    } catch (error) {
        devError("Inventory DELETE Error:", error);
        return internalErrorResponse();
    }
}

export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session) return unauthorizedResponse();

    // Use same permission as delete for now, as restoring is effectively undoing a delete
    const hasDeletePermission = await hasPermission(session.user.role || "USER", 'inventory.delete');
    if (!hasDeletePermission) {
        return forbiddenResponse("Bu işlem için yetkiniz yok (Envanter kaydı geri alma)");
    }

    try {
        const body = await req.json();
        const { id, action } = body;

        if (!id || action !== 'restore') {
            return errorResponse("Geçersiz istek", 400);
        }

        // TRANSACTIONAL RESTORE
        await prisma.$transaction(async (tx) => {
            // 1. Restore Item
            await tx.inventoryItem.update({
                where: { id },
                data: { deletedAt: null }
            });

            // 2. Audit Log
            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    action: "RESTORE",
                    entity: "INVENTORY",
                    entityId: id,
                    details: JSON.stringify({ id })
                }
            });
        });

        return successResponse(undefined, "Kayıt başarıyla geri yüklendi");
    } catch (error) {
        devError("Inventory PATCH Error:", error);
        return internalErrorResponse();
    }
}
