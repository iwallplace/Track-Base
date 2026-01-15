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

    // RBAC: inventory.view izin kontrolü
    const canViewInventory = await hasPermission(session.user.role || "USER", 'inventory.view');
    if (!canViewInventory) {
        return forbiddenResponse("Envanter listesini görüntüleme yetkiniz bulunmamaktadır");
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
            // Status affects which MATERIALS we show, so we must potentially filter materials by status of their latest item.
            // HOWEVER, filtering distinct list by "latest item status" in SQL is complex (Window Functions).
            // STRATEGY: 
            // - If status is filtered: We fetch distinct materials, but we might over-fetch and filter in memory for that page (better than fetching ALL).
            // - OR: We accept that "Status Filter" might be slightly expensive but scoped to pagination if possible.

            // Simplified Scalable Approach:
            // 1. Get Distinct Material References (Paginated) based on Search/Date
            // Note: DB-side distinct pagination is efficient.

            const queryWhere = { ...baseWhere };
            delete queryWhere.lastAction; // We need to calculate balance regardless of last action, but search/date applies.

            // 2. Count Total Distinct Materials (for Pagination UI)
            // Efficient: Fetch only the distinct values to count them. 
            // Ideally: groupBy return length.
            const distinctCount = await prisma.inventoryItem.groupBy({
                by: ['materialReference'],
                where: queryWhere,
                _count: { materialReference: true } // just for aggregation if needed, but array length is what matters
            });
            const total = distinctCount.length;

            // 3. Fetch PAGINATED Distinct Materials
            const distinctMaterials = await prisma.inventoryItem.findMany({
                where: queryWhere,
                select: { materialReference: true },
                distinct: ['materialReference'],
                orderBy: { materialReference: 'asc' },
                skip: limit ? (page - 1) * limit : undefined,
                take: limit
            });

            // 4. Process ONLY the visible items (Parallel Fetch)
            const processedResults = await Promise.all(distinctMaterials.map(async (mat) => {
                const ref = mat.materialReference;

                // A. Find Latest Item details
                const latestItem = await prisma.inventoryItem.findFirst({
                    where: { materialReference: ref, ...queryWhere },
                    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]
                });

                if (!latestItem) return null; // Should not happen if reference exists

                // B. Status Filter Check (Post-Fetch to keep SQL simple)
                if (status && latestItem.lastAction !== status) {
                    return null;
                }

                // C. Calculate Balance (Aggregate in DB)
                // Use baseWhere.deletedAt to properly filter deleted/non-deleted items
                const deletedAtFilter = baseWhere.deletedAt;
                const [entrySum, exitSum] = await Promise.all([
                    prisma.inventoryItem.aggregate({
                        _sum: { stockCount: true },
                        where: { materialReference: ref, lastAction: 'Giriş', deletedAt: deletedAtFilter }
                    }),
                    prisma.inventoryItem.aggregate({
                        _sum: { stockCount: true },
                        where: { materialReference: ref, lastAction: 'Çıkış', deletedAt: deletedAtFilter }
                    })
                ]);

                // Safe access to _sum with default 0
                const entryCount = entrySum._sum?.stockCount ?? 0;
                const exitCount = exitSum._sum?.stockCount ?? 0;
                const balance = entryCount - exitCount;

                return {
                    id: latestItem.id,
                    materialReference: ref,
                    company: latestItem.company || '',
                    waybillNo: latestItem.waybillNo,
                    date: latestItem.date,
                    stockCount: balance, // Global stock
                    lastAction: latestItem.lastAction,
                    year: latestItem.year,
                    month: latestItem.month,
                    week: latestItem.week,
                    note: latestItem.note || '',
                    lastModifiedBy: latestItem.lastModifiedBy
                } as InventorySummary;
            }));

            // Filter out nulls (Status mismatch)
            const finalProcessed: InventorySummary[] = processedResults.filter((i): i is InventorySummary => i !== null);

            // Note: If Status filter is active, we might return FEWER than 'limit' items per page.
            // This is a known trade-off for staying scalable without complex SQL subqueries.
            // The UI will handle having 45 items instead of 50 gracefully.

            // 5. Map Users
            const userIds = [...new Set(finalProcessed.map(i => i.lastModifiedBy).filter(Boolean) as string[])];
            const users = await prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, name: true }
            });
            const userMap = new Map(users.map(u => [u.id, u.name]));

            const finalItems = finalProcessed.map(item => ({
                ...item,
                modifierName: item.lastModifiedBy ? userMap.get(item.lastModifiedBy) || 'Bilinmeyen' : 'Sistem'
            }));

            return successResponse({
                items: finalItems,
                pagination: {
                    total, // Total DISTINCT materials (approximate if filtered by status, but accurate for navigation)
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

        // Strict Validation: Company is required for 'Giriş'
        if (data.lastAction === 'Giriş' && !data.company) {
            return validationErrorResponse("Giriş işlemleri için Firma adı zorunludur");
        }

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
                    waybillUrl: data.waybillUrl,
                    materialReference: data.materialReference,
                    stockCount: data.stockCount,
                    lastAction: data.lastAction || "Giriş",
                    note: data.note || "",
                    lastModifiedBy: session.user.id,
                    // New Fields
                    qcRequired: data.qcRequired || false,
                    qcStatus: data.qcRequired ? "PENDING" : "PENDING", // Default, but logical if not required? Maybe APPROVED if not required? Actually schema default is PENDING.
                    location: (data.aisle || data.shelf) ? `${data.aisle || ''}-${data.shelf || ''}` : undefined,
                    aisle: data.aisle,
                    shelf: data.shelf,
                    barcode: data.barcode
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
        const materialRef = searchParams.get('materialRef');
        const action = searchParams.get('action');

        // Bulk Delete by Material Reference
        if (materialRef && action === 'bulkDelete') {
            // Only ADMIN can bulk delete materials
            if (session.user.role !== 'ADMIN') {
                return forbiddenResponse("Sadece yöneticiler malzeme silebilir");
            }

            const result = await prisma.$transaction(async (tx) => {
                // Soft delete all items with this materialReference
                const updated = await tx.inventoryItem.updateMany({
                    where: {
                        materialReference: materialRef,
                        deletedAt: null
                    },
                    data: { deletedAt: new Date() }
                });

                // Audit Log
                await tx.auditLog.create({
                    data: {
                        userId: session.user.id,
                        action: "BULK_DELETE (SOFT)",
                        entity: "INVENTORY",
                        entityId: materialRef,
                        details: JSON.stringify({ materialReference: materialRef, count: updated.count })
                    }
                });

                return updated;
            });

            return successResponse({ deletedCount: result.count }, `${result.count} kayıt silindi (Arşivlendi)`);
        }

        // Single Item Delete
        if (!id) {
            return errorResponse("ID veya materialRef gerekli", 400);
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
    // Base session check is done above
    // Action-specific permissions are checked below


    try {
        const body = await req.json();
        const { id, action } = body;

        if (action === 'restore') {
            const hasDeletePermission = await hasPermission(session.user.role || "USER", 'inventory.delete');
            if (!hasDeletePermission) return forbiddenResponse("Bu işlem için yetkiniz yok");

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
        }

        if (action === 'qc_update') {
            // QC Permission Check
            const isQualityRole = session.user.role === 'KALITE' || session.user.role === 'ADMIN';
            // Or ideally use granular permission like: await hasPermission(session.user.role, 'inventory.qc');

            if (!isQualityRole) {
                return forbiddenResponse("Bu işlem için Kalite Kontrol yetkisi gerekli");
            }

            const { qcStatus, qcNote } = body;

            // TRANSACTIONAL QC UPDATE
            await prisma.$transaction(async (tx) => {
                // 1. Update Item
                await tx.inventoryItem.update({
                    where: { id },
                    data: {
                        qcStatus: qcStatus,
                        qcNote: qcNote
                    }
                });

                // 2. Audit Log
                await tx.auditLog.create({
                    data: {
                        userId: session.user.id,
                        action: "QC_UPDATE",
                        entity: "INVENTORY",
                        entityId: id,
                        details: JSON.stringify({ qcStatus, qcNote })
                    }
                });
            });

            return successResponse(undefined, "Kalite kontrol durumu güncellendi");
        }

        return errorResponse("Geçersiz işlem", 400);
    } catch (error) {
        devError("Inventory PATCH Error:", error);
        return internalErrorResponse();
    }
}
