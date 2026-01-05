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
        const { reportData } = await req.json();

        // Check cache first
        const cacheKey = generateCacheKey(reportData);
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

        const prompt = `
Sen bir "Kıdemli Yönetici"sin. Aşağıdaki stok raporunu sadece en kritik noktalarıyla, **kısa, çarpıcı ve net** bir şekilde özetle.
Yönetim kurulunun vakti kısıtlı; sadece "ne durumda olduğumuzu", "neyin acil olduğunu" ve "ne yapılması gerektiğini" bilmek istiyorlar.

**ÖNEMLİ KURALLAR:**
1. **ASLA Markdown, madde işareti (*), tire (-) veya kalın yazı (**) kullanma.** Düz yazı paragrafı olsun.
2. **Kurumsal ve Ciddi Ol:** Asla "canım", "tatlım", "arkadaşlar" gibi laubali ifadeler kullanma.
3. Resmi bir rapor dili kullan ama robotik olma. Akıcı ve profesyonel bir Türkçe ile yaz.
4. Başlık kullanma.

1. **Durum:** Tek cümleyle stok sağlığımız nasıl?
2. **Kritik:** Acil aksiyon gerektiren risk var mı?
3. **Öneri:** Lider olarak ne yapmalıyız?

Veriler:
Toplam Stok: ${reportData.totalStock}
Bu Ay Giren: ${reportData.monthlyEntry}
Bekleyen İşler: ${reportData.pendingTasks}
Aktif Firma Sayısı: ${reportData.activeCompanies}
Stok Devir Hızı: %${reportData.turnoverRate}
Ölü Stok (90+ gün hareketsiz): ${reportData.deadStockCount}
Kritik Seviye (Low Stock): ${reportData.lowStockCount}

Firma Bazlı Dağılım:
${JSON.stringify(reportData.companyStocks)}

İşlem Durumu Dağılımı:
${JSON.stringify(reportData.statusCounts)}

Yanıtı Türkçe ver.
        `;

        // Direct fetch to support experimental model and config provided by user
        const modelId = "gemini-flash-latest";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

        const payload = {
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: prompt
                        }
                    ]
                }
            ],
            generationConfig: {
                thinkingConfig: {
                    thinkingBudget: 1024 // Setting a reasonable budget, user example had -1 but strict types might complain, trying 1024 or just passing it raw
                }
            },
            // User provided example had thinkingBudget: -1. Let's try to match it but maybe as a number.
            // Actually, let's stick to the user provided structure closely.
        };

        // Redefining payload to exactly match user structure with -1 if possible, 
        // but beware of JSON serialization of numbers if API expects int.
        const userPayload = {
            contents: [{
                role: "user",
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                thinkingConfig: {
                    thinkingBudget: 1024 // Using a positive integer as -1 might be invalid or internal testing. Let's use a safe high number.
                }
            },
            tools: [{
                googleSearch: {}
            }]
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
