import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { updateProfileSchema, validate } from "@/lib/validations";
import {
    successResponse,
    errorResponse,
    unauthorizedResponse,
    validationErrorResponse,
    internalErrorResponse,
    notFoundResponse,
    devError
} from "@/lib/api-response";

export async function PUT(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();

        // Validate input
        const validation = validate(updateProfileSchema, body);
        if (!validation.success) {
            return validationErrorResponse(validation.error);
        }

        const { name, username, currentPassword, newPassword, image } = validation.data;
        const userId = session.user.id;

        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return notFoundResponse("Kullanıcı bulunamadı");
        }

        const updateData: Record<string, unknown> = {};

        if (name) updateData.name = name;
        if (username) updateData.username = username;
        if (image) updateData.image = image;

        if (newPassword) {
            if (!currentPassword) {
                return errorResponse("Mevcut şifre gerekli", 400);
            }

            const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isPasswordValid) {
                return errorResponse("Mevcut şifre hatalı", 400);
            }

            updateData.password = await bcrypt.hash(newPassword, 12);
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: { id: true, name: true, username: true, image: true, role: true }
        });

        return successResponse(updatedUser, "Profil güncellendi");
    } catch (error) {
        devError("Profile Update Error:", error);
        return internalErrorResponse();
    }
}
