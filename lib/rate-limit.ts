import { prisma } from "./db";

// Rate limiting configuration
const RATE_LIMITS = {
    auth: { requests: 5, windowSeconds: 60 },      // 5 requests per minute
    ai: { requests: 20, windowSeconds: 60 },       // 20 requests per minute  
    api: { requests: 60, windowSeconds: 60 },      // 60 requests per minute
    default: { requests: 100, windowSeconds: 60 }, // 100 requests per minute
};

/**
 * Get endpoint category from pathname
 */
function getEndpointCategory(pathname: string): string {
    if (pathname.startsWith("/api/auth")) return "auth";
    if (pathname.startsWith("/api/ai")) return "ai";
    if (pathname.startsWith("/api/")) return "api";
    return "default";
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
}

/**
 * PostgreSQL-based rate limiter using Prisma
 * Completely free - uses existing database
 */
export async function rateLimit(
    identifier: string,
    pathname: string
): Promise<RateLimitResult> {
    const endpoint = getEndpointCategory(pathname);
    const config = RATE_LIMITS[endpoint as keyof typeof RATE_LIMITS] || RATE_LIMITS.default;
    const windowStart = new Date(Date.now() - config.windowSeconds * 1000);

    try {
        // Count requests in current window
        const count = await prisma.rateLimitEntry.count({
            where: {
                identifier,
                endpoint,
                timestamp: { gte: windowStart }
            }
        });

        const remaining = Math.max(0, config.requests - count - 1);
        const reset = Date.now() + config.windowSeconds * 1000;

        if (count >= config.requests) {
            return {
                success: false,
                limit: config.requests,
                remaining: 0,
                reset
            };
        }

        // Add new entry (non-blocking - don't await)
        prisma.rateLimitEntry.create({
            data: { identifier, endpoint }
        }).catch(err => console.error("[RATE_LIMIT] Insert error:", err));

        return {
            success: true,
            limit: config.requests,
            remaining,
            reset
        };
    } catch (error) {
        console.error("[RATE_LIMIT] Error:", error);
        // Fail open - allow request if rate limiting fails
        return {
            success: true,
            limit: config.requests,
            remaining: config.requests,
            reset: Date.now() + config.windowSeconds * 1000
        };
    }
}

/**
 * Cleanup old rate limit entries (call periodically)
 * Removes entries older than 5 minutes
 */
export async function cleanupRateLimitEntries(): Promise<number> {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000);

    try {
        const result = await prisma.rateLimitEntry.deleteMany({
            where: { timestamp: { lt: cutoff } }
        });
        return result.count;
    } catch (error) {
        console.error("[RATE_LIMIT] Cleanup error:", error);
        return 0;
    }
}

/**
 * Check if rate limiting is enabled (always true for PostgreSQL)
 */
export function isRateLimitEnabled(): boolean {
    return true;
}
