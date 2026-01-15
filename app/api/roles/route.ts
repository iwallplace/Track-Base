
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/db";
import {
    successResponse,
    errorResponse,
    unauthorizedResponse,
    forbiddenResponse,
    internalErrorResponse,
    devError
} from "@/lib/api-response";
import { hasPermission } from "@/lib/permissions";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return unauthorizedResponse();

    try {
        const roles = await prisma.role.findMany({
            orderBy: { name: 'asc' }
        });
        return successResponse(roles);
    } catch (error) {
        devError("Roles GET Error:", error);
        return internalErrorResponse();
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return unauthorizedResponse();

    // Only Admin can create roles
    if (session.user.role !== 'ADMIN') {
        return forbiddenResponse("Sadece Project Owner rol oluşturabilir");
    }

    try {
        const body = await req.json();
        const { name, label, color } = body;

        if (!name || !label) {
            return errorResponse("Rol adı ve etiketi gereklidir", 400);
        }

        const existing = await prisma.role.findUnique({
            where: { name: name.toUpperCase() }
        });

        if (existing) {
            return errorResponse("Bu rol kodu zaten mevcut", 409);
        }

        const role = await prisma.role.create({
            data: {
                name: name.toUpperCase(),
                label,
                color: color || 'gray',
                isSystem: false
            }
        });

        return successResponse(role, "Rol oluşturuldu", 201);
    } catch (error) {
        devError("Roles POST Error:", error);
        return internalErrorResponse();
    }
}

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return unauthorizedResponse();

    if (session.user.role !== 'ADMIN') {
        return forbiddenResponse("Sadece Project Owner rol silebilir");
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return errorResponse("ID gerekli", 400);

    try {
        const role = await prisma.role.findUnique({ where: { id } });

        if (!role) return errorResponse("Rol bulunamadı", 404);

        if (role.isSystem) {
            return forbiddenResponse("Sistem rolleri silinemez");
        }

        // Check if role is in use
        const userCount = await prisma.user.count({ where: { role: role.name } });
        if (userCount > 0) {
            return errorResponse(`Bu rolü kullanan ${userCount} kullanıcı var. Önce kullanıcıların rolünü değiştirin.`, 409);
        }

        await prisma.role.delete({ where: { id } });

        return successResponse(undefined, "Rol silindi");
    } catch (error) {
        devError("Roles DELETE Error:", error);
        return internalErrorResponse();
    }
}
