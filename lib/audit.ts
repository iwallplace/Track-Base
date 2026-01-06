import { prisma } from "@/lib/db";

export async function createAuditLog(
    userId: string,
    action: string,
    entity: string,
    entityId: string | null,
    details: any
) {
    try {
        await prisma.auditLog.create({
            data: {
                userId,
                action,
                entity,
                entityId,
                details: typeof details === 'string' ? details : JSON.stringify(details)
            }
        });
    } catch (error) {
        console.error("Failed to create audit log:", error);
        // Fail silently to not block the main action, but log to console
    }
}
