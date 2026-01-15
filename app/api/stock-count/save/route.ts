import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // RBAC: stock-count.manage izin kontrolü
        const canManage = await hasPermission(session.user.role || 'USER', 'stock-count.manage');
        if (!canManage) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        const body = await req.json();
        const { sessionId, materialReference, countedStock, systemStock, note } = body;

        if (!sessionId || !materialReference || countedStock === undefined) {
            return new NextResponse("Missing required fields", { status: 400 });
        }

        // Verify session belongs to user
        const stockSession = await prisma.stockCountSession.findUnique({
            where: { id: sessionId }
        });

        if (!stockSession) {
            return new NextResponse("Session not found", { status: 404 });
        }

        if (stockSession.createdById !== session.user.id) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        // Upsert the entry
        const countedNum = parseInt(countedStock);
        const systemNum = parseInt(systemStock);

        // Validate parsed numbers
        if (isNaN(countedNum) || isNaN(systemNum)) {
            return new NextResponse("Invalid stock count values", { status: 400 });
        }

        const difference = countedNum - systemNum;
        const status = difference === 0 ? 'MATCH' : 'MISMATCH';

        const entry = await prisma.stockCountEntry.upsert({
            where: {
                sessionId_materialReference: {
                    sessionId,
                    materialReference
                }
            },
            update: {
                countedStock: countedNum,
                systemStock: systemNum,
                difference,
                status,
                note,
                countedAt: new Date()
            },
            create: {
                sessionId,
                materialReference,
                countedStock: countedNum,
                systemStock: systemNum,
                difference,
                status,
                note
            }
        });

        return NextResponse.json(entry);

    } catch (error) {
        console.error("Save Count Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
