import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Strict Admin Check as requested
        if (session.user.role !== 'ADMIN') {
            return new NextResponse("Forbidden", { status: 403 });
        }

        const logs = await prisma.auditLog.findMany({
            take: 100,
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
