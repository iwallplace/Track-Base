
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const dismissSchema = z.object({
    ids: z.array(z.string()),
    type: z.string()
});

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const body = await req.json();
        const { ids, type } = dismissSchema.parse(body);

        if (ids.length === 0) {
            return NextResponse.json({ success: true });
        }

        // Create notification state records for each dismissed item
        // Use createMany if supported (Postgres supports it)
        await prisma.notificationState.createMany({
            data: ids.map(id => ({
                userId: session.user.id,
                notificationId: id,
                type: type
            })),
            skipDuplicates: true // Important: avoid unique constraint errors if already dismissed
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Dismiss Error:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
