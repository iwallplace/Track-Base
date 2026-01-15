import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/db";
import crypto from 'crypto';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour in milliseconds

// Generate a hash from report data to use as cache key
function generateCacheKey(reportData: any, language: string): string {
    const dataString = JSON.stringify({
        totalStock: reportData.totalStock,
        monthlyEntry: reportData.monthlyEntry,
        pendingTasks: reportData.pendingTasks,
        activeCompanies: reportData.activeCompanies,
        turnoverRate: reportData.turnoverRate,
        deadStockCount: reportData.deadStockCount,
        lowStockCount: reportData.lowStockCount,
        language
    });
    return crypto.createHash('md5').update(dataString).digest('hex');
}

// Cleanup expired cache entries (runs periodically)
async function cleanupExpiredCache() {
    try {
        const deleted = await prisma.aISummaryCache.deleteMany({
            where: {
                expiresAt: { lt: new Date() }
            }
        });
        if (deleted.count > 0) {
            console.log(`[AI Cache] Cleaned up ${deleted.count} expired entries`);
        }
    } catch (error) {
        console.error("[AI Cache] Cleanup error:", error);
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    try {
        const { reportData, language = 'tr' } = await req.json();

        // Generate cache key
        const cacheKey = generateCacheKey(reportData, language);

        // Check database cache first
        const cachedEntry = await prisma.aISummaryCache.findUnique({
            where: { cacheKey }
        });

        if (cachedEntry && cachedEntry.expiresAt > new Date()) {
            console.log("[AI Cache] Returning cached summary from database");
            return NextResponse.json({
                text: cachedEntry.summary,
                cached: true,
                expiresAt: cachedEntry.expiresAt.toISOString()
            });
        }

        // If expired entry exists, delete it
        if (cachedEntry) {
            await prisma.aISummaryCache.delete({ where: { cacheKey } });
        }

        // Cleanup old entries periodically (fire and forget)
        cleanupExpiredCache();

        // Generate new summary via Gemini API
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("API Key missing");
            return NextResponse.json({
                text: "Google Gemini API anahtarı bulunamadı. Lütfen .env dosyanıza GEMINI_API_KEY ekleyin."
            }, { status: 500 });
        }

        const isEnglish = language === 'en';

        const prompt = `
You are a "Senior Executive". Summarize the stock report below in a **short, striking, and clear** manner, highlighting only the most critical points.
The board has limited time; they just want to know "how we are doing", "what is urgent", and "what needs to be done".

**IMPORTANT RULES:**
1. **NEVER use Markdown, bullet points (*), dashes (-), or bold text (**).** Provide a plain text paragraph.
2. **Be Corporate and Serious:** Never use casual expressions like "dear", "folks", etc.
3. Use a formal reporting language but don't be robotic. Write in fluent and professional ${isEnglish ? 'English' : 'Turkish'}.
4. Do not use headers.

1. **Status:** How is our stock health in one sentence?
2. **Critical:** Is there any urgent risk requiring action?
3. **Suggestion:** As a leader, what should we do?

Data:
Total Stock: ${reportData.totalStock}
Monthly Entry: ${reportData.monthlyEntry}
Turnover Rate: %${reportData.turnoverRate}
Dead Stock (90+ days): ${reportData.deadStockCount}
Critical Level (Low Stock): ${reportData.lowStockCount}

Company Distribution:
${JSON.stringify(reportData.companyStocks)}

Transaction Status Distribution:
${JSON.stringify(reportData.statusCounts)}

**Output Language:** ${isEnglish ? 'English' : 'Turkish'}
        `;

        const modelId = "gemini-flash-latest";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

        const userPayload = {
            contents: [{
                role: "user",
                parts: [{ text: prompt }]
            }],
            generationConfig: {}
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userPayload)
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error("Gemini API External Error:", errorText);
            return NextResponse.json({ error: `Gemini API Error (${res.status}): ${errorText}` }, { status: res.status });
        }

        const data = await res.json();

        // Parse response content
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            console.error("Gemini API: No text in response", JSON.stringify(data));
            return NextResponse.json({ error: "No text content in response" }, { status: 500 });
        }

        // Calculate expiration time (1 hour from now)
        const expiresAt = new Date(Date.now() + CACHE_TTL_MS);

        // Save to database cache (upsert in case of race condition)
        await prisma.aISummaryCache.upsert({
            where: { cacheKey },
            update: {
                summary: text,
                language,
                expiresAt
            },
            create: {
                cacheKey,
                summary: text,
                language,
                expiresAt
            }
        });
        console.log("[AI Cache] Summary saved to database, expires at:", expiresAt.toISOString());

        return NextResponse.json({
            text,
            cached: false,
            expiresAt: expiresAt.toISOString()
        });

    } catch (error) {
        console.error("Gemini API Internal Error:", error);
        return NextResponse.json({ error: "Internal Server Error: " + (error as any).message }, { status: 500 });
    }
}
