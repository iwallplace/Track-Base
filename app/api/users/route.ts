import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createUserSchema, updateUserSchema, validate } from "@/lib/validations";
import {
    successResponse,
    errorResponse,
    unauthorizedResponse,
    forbiddenResponse,
    validationErrorResponse,
    internalErrorResponse,
    notFoundResponse,
    devError
} from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";

const ALLOWED_ROLES = ['ADMIN', 'IME', 'KALITE'];

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return unauthorizedResponse();
    }

    const { searchParams } = new URL(req.url);
    const showDeleted = searchParams.get('showDeleted') === 'true';

    try {
        const where: any = {};

        // Soft Delete Logic
        if (showDeleted && session.user.role === 'ADMIN') {
            // Admin asked for deleted: Show deleted + active? Or just deleted? 
            // Usually simpler to show ALL or just deleted.
            // Let's mimic Inventory: if showDeleted=true, show deleted items.
            where.deletedAt = { not: null };
        } else {
            // Default: active only
            where.deletedAt = null;
        }

        const users = await prisma.user.findMany({
            where,
            select: { id: true, name: true, username: true, role: true, createdAt: true, deletedAt: true },
            orderBy: { createdAt: 'desc' }
        });
        return successResponse(users);
    } catch (error) {
        devError("Users GET Error:", error);
        return internalErrorResponse();
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user.role || !ALLOWED_ROLES.includes(session.user.role)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();

        // Validate input
        const validation = validate(createUserSchema, body);
        if (!validation.success) {
            return validationErrorResponse(validation.error);
        }

        const { name, username, password, role } = validation.data;

        // Check if username already exists
        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing) {
            return errorResponse("Bu kullanıcı adı zaten kullanılıyor", 409);
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await prisma.user.create({
            data: {
                name,
                username,
                password: hashedPassword,
                role
            },
            select: { id: true, name: true, username: true, role: true, createdAt: true }
        });

        await createAuditLog(
            session.user.id,
            "CREATE",
            "USER",
            user.id,
            { username: user.username, role: user.role }
        );

        return successResponse(user, "Kullanıcı oluşturuldu", 201);
    } catch (error) {
        devError("Users POST Error:", error);
        return internalErrorResponse();
    }
}

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user.role || !ALLOWED_ROLES.includes(session.user.role)) {
        return unauthorizedResponse();
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        return errorResponse("ID gerekli", 400);
    }

    try {
        const targetUser = await prisma.user.findUnique({ where: { id } });

        if (!targetUser) {
            return notFoundResponse("Kullanıcı bulunamadı");
        }

        if (targetUser.role === 'ADMIN') {
            return forbiddenResponse("Project Owner silinemez");
        }

        // SOFT DELETE
        const deletedUser = await prisma.user.update({
            where: { id },
            data: { deletedAt: new Date() }
        });

        await createAuditLog(
            session.user.id,
            "DELETE (SOFT)",
            "USER",
            id,
            { deletedUsername: deletedUser.username }
        );

        return successResponse(undefined, "Kullanıcı silindi (Arşivlendi)");
    } catch (error) {
        devError("Users DELETE Error:", error);
        return internalErrorResponse();
    }
}

export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
        return forbiddenResponse("Sadece Project Owner kullanıcıları geri yükleyebilir");
    }

    try {
        const body = await req.json();
        const { id, action } = body;

        if (!id || action !== 'restore') {
            return errorResponse("Geçersiz istek", 400);
        }

        const restoredUser = await prisma.user.update({
            where: { id },
            data: { deletedAt: null }
        });

        await createAuditLog(
            session.user.id,
            "RESTORE",
            "USER",
            id,
            { username: restoredUser.username }
        );

        return successResponse(undefined, "Kullanıcı geri yüklendi");
    } catch (error) {
        devError("Users PATCH Error:", error);
        return internalErrorResponse();
    }
}

export async function PUT(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user.role || !ALLOWED_ROLES.includes(session.user.role)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();

        // Validate input
        const validation = validate(updateUserSchema, body);
        if (!validation.success) {
            return validationErrorResponse(validation.error);
        }

        const { id, name, username, password, role } = validation.data;

        const targetUser = await prisma.user.findUnique({ where: { id } });
        if (!targetUser) {
            return notFoundResponse("Kullanıcı bulunamadı");
        }

        // Permission Check: IME/KALITE can only manage USER role
        if (session.user.role !== 'ADMIN') {
            if (targetUser.role !== 'USER') {
                return forbiddenResponse("Sadece İnci Personeli kullanıcılarını yönetebilirsiniz");
            }
            if (role && role !== 'USER') {
                return forbiddenResponse("Kullanıcı rolünü değiştiremezsiniz");
            }
        }

        const updateData: Record<string, unknown> = {};
        if (name) updateData.name = name;
        if (username) updateData.username = username;
        if (password) {
            updateData.password = await bcrypt.hash(password, 12);
        }
        if (role && session.user.role === 'ADMIN') {
            updateData.role = role;
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: updateData,
            select: { id: true, name: true, username: true, role: true, createdAt: true }
        });

        await createAuditLog(
            session.user.id,
            "UPDATE",
            "USER",
            updatedUser.id,
            { changedFields: Object.keys(updateData) }
        );

        return successResponse(updatedUser, "Kullanıcı güncellendi");
    } catch (error) {
        devError("Users PUT Error:", error);
        return internalErrorResponse();
    }
}
