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

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session) {
        return unauthorizedResponse();
    }

    try {
        const inventory = await prisma.inventoryItem.findMany({
            orderBy: { createdAt: "desc" },
        });

        const users = await prisma.user.findMany({
            select: { id: true, name: true }
        });

        const userMap = new Map(users.map(u => [u.id, u.name]));

        const enrichedInventory = inventory.map(item => ({
            ...item,
            modifierName: item.lastModifiedBy ? userMap.get(item.lastModifiedBy) || 'Bilinmeyen' : 'Sistem'
        }));

        return successResponse(enrichedInventory);
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

        // Validate input
        const validation = validate(createInventoryItemSchema, body);
        if (!validation.success) {
            return validationErrorResponse(validation.error);
        }

        const data = validation.data;

        const item = await prisma.inventoryItem.create({
            data: {
                year: data.year,
                month: data.month,
                week: data.week,
                date: new Date(data.date),
                company: data.company,
                waybillNo: data.waybillNo || "",
                materialReference: data.materialReference,
                stockCount: data.stockCount,
                lastAction: data.lastAction || "",
                note: data.note || "",
                lastModifiedBy: session.user.id
            }
        });

        return successResponse(item, "Envanter kaydı oluşturuldu");
    } catch (error) {
        devError("Inventory POST Error:", error);
        return internalErrorResponse();
    }
}

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
        return forbiddenResponse("Sadece Project Owner silme işlemi yapabilir");
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
