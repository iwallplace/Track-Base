import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const dateParam = searchParams.get('date');

        // Use provided date or today
        const targetDate = dateParam ? new Date(dateParam) : new Date();
        const start = startOfDay(targetDate);
        const end = endOfDay(targetDate);

        // Find existing session for this user and date
        let stockSession = await prisma.stockCountSession.findFirst({
            where: {
                createdById: session.user.id,
                sessionDate: {
                    gte: start,
                    lte: end
                }
            },
            include: {
                entries: true
            }
        });

        // If no session exists, create one only if explicitly requested via query param 'create=true'
        // Otherwise return null so frontend can decide
        const shouldCreate = searchParams.get('create') === 'true';

        if (!stockSession && shouldCreate) {
            stockSession = await prisma.stockCountSession.create({
                data: {
                    sessionDate: targetDate, // Use the specific date requested
                    createdById: session.user.id,
                    status: 'IN_PROGRESS'
                },
                include: {
                    entries: true
                }
            });
        }

        return NextResponse.json(stockSession);

    } catch (error) {
        console.error("Stock Session Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
