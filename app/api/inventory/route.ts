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

        const item = await prisma.inventoryItem.create({
            data: {
                year: year,
                month: month,
                week: week,
                date: date,
                company: data.company,
                waybillNo: data.waybillNo || "",
                materialReference: data.materialReference,
                stockCount: data.stockCount,
                lastAction: data.lastAction || "Giriş",
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
