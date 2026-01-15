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
    // New Fields
    material?: {
        abcClass: string | null;
        minStock: number;
        unit: string;
        defaultLocation: string | null;
        description: string | null;
    } | null;
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

    // New Filters
    const showDeleted = searchParams.get('showDeleted') === 'true';
    const abcClass = searchParams.get('abcClass'); // 'A', 'B', 'C'
    const stockStatus = searchParams.get('stockStatus'); // 'CRITICAL', 'NORMAL'

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

        // --- PRE-FILTERING BY MATERIAL METADATA (ABC / STOCK STATUS) ---
        // If ABC or Stock Status is requested, we MUST filter by materialReference first.
        // For Stock Status, we need MinStock even if we calculate balance later.
        let allowedMaterials: Set<string> | null = null;
        let materialMinStocks: Map<string, number> = new Map();

        if (abcClass || stockStatus) {
            const materialWhere: any = {};
            if (abcClass) materialWhere.abcClass = abcClass;

            // For stock status, we just need to fetch materials to know their MinStock
            // We can't filter by "Critical" here because that depends on Balance vs MinStock.

            const materials = await prisma.material.findMany({
                where: materialWhere,
                select: { reference: true, minStock: true }
            });

            allowedMaterials = new Set(materials.map(m => m.reference));
            materials.forEach(m => materialMinStocks.set(m.reference, m.minStock));

            // Apply to baseWhere immediately to reduce DB load
            if (baseWhere.materialReference) {
                // If search already filtered references, intersect it?
                // Actually search is "contains", this is "in". Prisma handles AND correctly.
                baseWhere.materialReference = {
                    ...baseWhere.materialReference, // keep generic search
                    in: Array.from(allowedMaterials)
                };
            } else {
                baseWhere.materialReference = { in: Array.from(allowedMaterials) };
            }
        }

        if (view === 'summary' && !showDeleted) {
            // Simplified Scalable Approach:
            // 1. Get Distinct Material References (Paginated) based on Search/Date

            const queryWhere = { ...baseWhere };
            delete queryWhere.lastAction; // Calculate balance regardless of last action

            // 2. Count Total Distinct Materials
            const distinctCount = await prisma.inventoryItem.groupBy({
                by: ['materialReference'],
                where: queryWhere,
                _count: { materialReference: true }
            });
            const total = distinctCount.length;

            // 3. Fetch PAGINATED Distinct Materials
            // NOTE: If filtering by StockStatus (Critical), we CANNOT paginate here easily 
            // because we don't know which ones are critical until we calculate balance.
            // Trade-off: If stockStatus is active, we might fetch MORE, check balance, and then slice.
            // For now, let's assume if stockStatus is Set, we might have to scan more or accept pagination imperfections.
            // BETTER: If stockStatus is Set, we fetch ALL matches (up to a safe limit like 500), filter in memory, then paginate.

            let fetchLimit = limit;
            let fetchSkip = limit ? (page - 1) * limit : undefined;

            if (stockStatus) {
                fetchLimit = 500; // Hard limit for critical checks to avoid OOM
                fetchSkip = undefined; // Fetch all candidates, then filter
            }

            const distinctMaterials = await prisma.inventoryItem.findMany({
                where: queryWhere,
                select: { materialReference: true },
                distinct: ['materialReference'],
                orderBy: { materialReference: 'asc' },
                skip: fetchSkip,
                take: fetchLimit
            });

            // 4. Process candidates
            const processedResults = await Promise.all(distinctMaterials.map(async (mat) => {
                const ref = mat.materialReference;

                // A. Find Latest Item details
                const latestItem = await prisma.inventoryItem.findFirst({
                    where: { materialReference: ref, ...queryWhere },
                    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]
                });

                if (!latestItem) return null;

                // B. Status Filter Check
                if (status && latestItem.lastAction !== status) {
                    return null;
                }

                // C. Calculate Balance
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

                const entryCount = entrySum._sum?.stockCount ?? 0;
                const exitCount = exitSum._sum?.stockCount ?? 0;
                const balance = entryCount - exitCount;

                // D. Stock Status Filter Check (CRITICAL)
                if (stockStatus) {
                    // We need minStock. Check map first, if missing fetch it (lazy load if not in pre-filter)
                    let minStock = materialMinStocks.get(ref);
                    if (minStock === undefined) {
                        const m = await prisma.material.findUnique({ where: { reference: ref }, select: { minStock: true } });
                        minStock = m?.minStock ?? 20; // Default 20 logic matches frontend?
                    }

                    if (stockStatus === 'CRITICAL') {
                        if (balance > minStock) return null; // Not critical
                    } else if (stockStatus === 'NORMAL') {
                        if (balance <= minStock) return null; // Is critical
                    }
                }

                return {
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
                } as InventorySummary;
            }));

            // Filter out nulls
            let finalProcessed = processedResults.filter((i): i is InventorySummary => i !== null);

            // Handle Manual Pagination for Stock Status Filter
            let responseTotal = total;

            if (stockStatus) {
                responseTotal = finalProcessed.length;
                if (limit) {
                    const localSkip = (page - 1) * limit;
                    finalProcessed = finalProcessed.slice(localSkip, localSkip + limit);
                }
            }

            // 5. Map Users
            const userIds = [...new Set(finalProcessed.map(i => i.lastModifiedBy).filter(Boolean) as string[])];
            const users = await prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, name: true }
            });
            const userMap = new Map(users.map(u => [u.id, u.name]));

            // 6. Fetch Material Metadata for these items
            const materialRefs = [...new Set(finalProcessed.map(i => i.materialReference))];
            const materials = await prisma.material.findMany({
                where: { reference: { in: materialRefs } },
                select: { reference: true, abcClass: true, minStock: true, unit: true, defaultLocation: true, description: true }
            });
            const materialMap = new Map(materials.map(m => [m.reference, m]));

            const finalItems = finalProcessed.map(item => {
                const material = materialMap.get(item.materialReference);
                return {
                    ...item,
                    modifierName: item.lastModifiedBy ? userMap.get(item.lastModifiedBy) || 'Bilinmeyen' : 'Sistem',
                    material: material ? {
                        abcClass: material.abcClass,
                        minStock: material.minStock,
                        unit: material.unit,
                        defaultLocation: material.defaultLocation,
                        description: material.description
                    } : null
                };
            });

            return successResponse({
                items: finalItems,
                pagination: {
                    total: responseTotal,
                    page,
                    limit: limit || responseTotal,
                    totalPages: limit ? Math.ceil(responseTotal / limit) : 1
                }
            });
        }

        // Standard List View (Raw Data)
        // Note: Filters work on raw view too, but Stock Status (Critical) is meaningless on raw rows (balance is calculated).
        // If stockStatus is requested on raw view, we might ignore it
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
        const materialRefs = [...new Set(inventory.map(i => i.materialReference))];

        const [users, materials] = await Promise.all([
            prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, name: true }
            }),
            prisma.material.findMany({
                where: { reference: { in: materialRefs } },
                select: { reference: true, abcClass: true, minStock: true, unit: true, defaultLocation: true, description: true }
            })
        ]);

        const userMap = new Map(users.map(u => [u.id, u.name]));
        const materialMap = new Map(materials.map(m => [m.reference, m]));

        const enrichedInventory = inventory.map(item => {
            const material = materialMap.get(item.materialReference);
            return {
                ...item,
                modifierName: item.lastModifiedBy ? userMap.get(item.lastModifiedBy) || 'Bilinmeyen' : 'Sistem',
                material: material ? {
                    abcClass: material.abcClass,
                    minStock: material.minStock,
                    unit: material.unit,
                    defaultLocation: material.defaultLocation,
                    description: material.description
                } : null
            };
        });

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
