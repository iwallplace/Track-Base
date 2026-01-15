import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // RBAC: audit.view izin kontrolü
        const canViewAudit = await hasPermission(session.user.role || "USER", 'audit.view');
        if (!canViewAudit) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        // Parse limit from query params
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '100');
        const take = Math.min(limit, 1000); // Cap at 1000 for safety

        const logs = await prisma.auditLog.findMany({
            take,
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                user: {
                    select: {
                        name: true,
                        image: true,
                        username: true
                    }
                }
            }
        });

        return NextResponse.json(logs);

    } catch (error) {
        console.error("Audit Log Fetch Error:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
