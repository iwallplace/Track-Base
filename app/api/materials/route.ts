import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, internalErrorResponse } from "@/lib/api-response";
import { hasPermission } from "@/lib/permissions";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return unauthorizedResponse();

    try {
        const { searchParams } = new URL(req.url);
        const search = searchParams.get('search') || '';

        const where: any = {};
        if (search) {
            where.reference = { contains: search, mode: 'insensitive' };
        }

        // 1. Get defined materials
        const materials = await prisma.material.findMany({
            where,
            orderBy: { reference: 'asc' },
            take: 100
        });

        // 2. Get used references from Inventory (if searching or generally)
        // Note: Prisma distinct is efficient.
        const inventoryRefs = await prisma.inventoryItem.findMany({
            where: {
                materialReference: search ? { contains: search, mode: 'insensitive' } : undefined
            },
            distinct: ['materialReference'],
            select: { materialReference: true },
            take: 100
        });

        // 3. Merge: If ref exists in materials, use it. If not, create a dummy object.
        const mergedMap = new Map();

        // Add existing definitions
        materials.forEach(m => mergedMap.set(m.reference, m));

        // Add potential missing ones (default limit 20)
        inventoryRefs.forEach(item => {
            if (!mergedMap.has(item.materialReference)) {
                mergedMap.set(item.materialReference, {
                    id: null, // Indicates not saved yet
                    reference: item.materialReference,
                    minStock: 20,
                    description: ''
                });
            }
        });

        return successResponse(Array.from(mergedMap.values()).sort((a, b) => a.reference.localeCompare(b.reference)));
    } catch (error) {
        console.error("Materials GET Error:", error);
        return internalErrorResponse();
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return unauthorizedResponse();

    // Check permissions (Admin or maybe Quality/IME can set limits)
    const canManage = session.user.role === 'ADMIN' || session.user.role === 'IME';
    if (!canManage) return forbiddenResponse("Bu işlem için yetkiniz yok");

    try {
        const body = await req.json();
        const { reference, minStock, description } = body;

        if (!reference || typeof minStock !== 'number') {
            return errorResponse("Referans ve Kritik Stok değeri gereklidir", 400);
        }

        // Upsert: Update if exists, Create if not
        const material = await prisma.material.upsert({
            where: { reference },
            update: { minStock, description },
            create: { reference, minStock, description }
        });

        return successResponse(material, "Malzeme tanımı güncellendi");
    } catch (error) {
        console.error("Materials POST Error:", error);
        return internalErrorResponse();
    }
}
