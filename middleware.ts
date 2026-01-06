import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit, isRateLimitEnabled } from "@/lib/rate-limit";

export default withAuth(
    async function middleware(req: NextRequest) {
        const response = NextResponse.next();

        // =====================
        // 1. Rate Limiting (PostgreSQL - Free)
        // =====================
        if (isRateLimitEnabled()) {
            // Use IP address as identifier (with fallback)
            const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
                || req.headers.get("x-real-ip")
                || "anonymous";

            const result = await rateLimit(ip, req.nextUrl.pathname);

            // Add rate limit headers to response
            response.headers.set("X-RateLimit-Limit", result.limit.toString());
            response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
            response.headers.set("X-RateLimit-Reset", result.reset.toString());

            if (!result.success) {
                // Calculate retry-after in seconds
                const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);

                return new NextResponse(
                    JSON.stringify({
                        success: false,
                        error: "Çok fazla istek gönderildi. Lütfen bir dakika bekleyin.",
                        code: "RATE_LIMIT_EXCEEDED",
                        retryAfter
                    }),
                    {
                        status: 429,
                        headers: {
                            "Content-Type": "application/json",
                            "Retry-After": retryAfter.toString(),
                            "X-RateLimit-Limit": result.limit.toString(),
                            "X-RateLimit-Remaining": "0",
                            "X-RateLimit-Reset": result.reset.toString()
                        }
                    }
                );
            }
        }

        // =====================
        // 2. CSP (Content Security Policy)
        // =====================
        const cspHeader = `
            default-src 'self';
            script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.vercel-scripts.com;
            style-src 'self' 'unsafe-inline';
            img-src 'self' data: blob: https:;
            font-src 'self';
            object-src 'none';
            base-uri 'self';
            form-action 'self';
            frame-ancestors 'none';
            block-all-mixed-content;
            upgrade-insecure-requests;
        `.replace(/\s{2,}/g, ' ').trim();

        response.headers.set('Content-Security-Policy', cspHeader);

        // =====================
        // 3. Security Headers
        // =====================
        response.headers.set('X-Content-Type-Options', 'nosniff');
        response.headers.set('X-Frame-Options', 'DENY');
        response.headers.set('X-XSS-Protection', '1; mode=block');
        response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

        // HSTS - Force HTTPS (1 year with subdomains)
        response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

        // Permissions-Policy - Disable unnecessary browser features
        response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

        return response;
    },
    {
        pages: {
            signIn: "/login",
        },
    }
);

export const config = {
    matcher: [
        // Protected dashboard routes
        "/dashboard/:path*",
        // Protected API routes (excluding public auth endpoints)
        "/api/inventory/:path*",
        "/api/users/:path*",
        "/api/profile/:path*",
        "/api/notifications/:path*",
        "/api/ai/:path*",
        "/api/email/:path*",
        "/api/audit-logs/:path*",
        "/api/permissions/:path*",
    ],
};
