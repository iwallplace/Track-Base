import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import crypto from 'crypto';

// In-memory cache for AI summaries (1 hour TTL)
interface CacheEntry {
    text: string;
    timestamp: number;
}

const summaryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour in milliseconds

// Generate a hash from report data to use as cache key
function generateCacheKey(reportData: any): string {
    const dataString = JSON.stringify({
        totalStock: reportData.totalStock,
        monthlyEntry: reportData.monthlyEntry,
        pendingTasks: reportData.pendingTasks,
        activeCompanies: reportData.activeCompanies,
        turnoverRate: reportData.turnoverRate,
        deadStockCount: reportData.deadStockCount,
        lowStockCount: reportData.lowStockCount,
    });
    return crypto.createHash('md5').update(dataString).digest('hex');
}

// Clean up expired cache entries periodically
function cleanupCache() {
    const now = Date.now();
    for (const [key, entry] of summaryCache.entries()) {
        if (now - entry.timestamp > CACHE_TTL_MS) {
            summaryCache.delete(key);
        }
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    try {
        const { reportData, language = 'tr' } = await req.json(); // Default to 'tr' if no language provided

        // Check cache first (Cache key should include language now!)
        // However, user might change language and request same data.
        // Let's create a composite key.
        const cacheKey = generateCacheKey({ ...reportData, language });
        const cachedEntry = summaryCache.get(cacheKey);

        if (cachedEntry) {
            const isExpired = Date.now() - cachedEntry.timestamp > CACHE_TTL_MS;
            if (!isExpired) {
                console.log("Returning cached AI summary");
                return NextResponse.json({ text: cachedEntry.text, cached: true });
            } else {
                // Clean up this expired entry
                summaryCache.delete(cacheKey);
            }
        }

        // Cleanup old entries periodically
        cleanupCache();

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

        // Direct fetch to support experimental model and config provided by user
        const modelId = "gemini-flash-latest"; // Or gemini-2.0-flash-exp
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

        const userPayload = {
            contents: [{
                role: "user",
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                // thinkingConfig: {
                //    thinkingBudget: 1024 
                // }
                // Removing thinkingConfig for now as 'gemini-flash-latest' might not support it or it causes 400s if not on experimental endpoint.
                // Keeping it simple and robust.
            }
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

        // Save to cache
        summaryCache.set(cacheKey, {
            text: text,
            timestamp: Date.now()
        });
        console.log("AI summary cached for 1 hour");

        return NextResponse.json({ text, cached: false });

    } catch (error) {
        console.error("Gemini API Internal Error:", error);
        return NextResponse.json({ error: "Internal Server Error: " + (error as any).message }, { status: 500 });
    }
}
