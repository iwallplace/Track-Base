import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit, isRateLimitEnabled } from "@/lib/rate-limit";

export default withAuth(
    async function middleware(req: NextRequest) {
        const token = (req as any).nextauth.token;
        const isApiRoute = req.nextUrl.pathname.startsWith('/api');
        const isDashboardRoute = req.nextUrl.pathname.startsWith('/dashboard');

        // Manual Auth Check for API to avoid HTML Redirects
        if (isApiRoute && !token) {
            return new NextResponse(
                JSON.stringify({ success: false, message: "Authentication required" }),
                { status: 401, headers: { "Content-Type": "application/json" } }
            );
        }

        // Dashboard Guard (Standard Redirect handled by withAuth usually, but since we override "authorized" below, we might need this OR rely on withAuth's default behavior if we return false?
        // Actually, if we use "authorized" callback and return true, we MUST handle redirects here.
        // If we don't use "authorized" callback, withAuth handles it.
        // BUT withAuth redirects API calls too.

        // So we MUST use "authorized" callback to ALWAYS return true (allow into middleware)
        // AND handle auth checks here.

        if (isDashboardRoute && !token) {
            const signInUrl = new URL("/login", req.url);
            signInUrl.searchParams.set("callbackUrl", req.url);
            return NextResponse.redirect(signInUrl);
        }

        const response = NextResponse.next();

        // =====================
        // 1. Rate Limiting (PostgreSQL - Free)
        // =====================
        if (isRateLimitEnabled()) {
            // ... existing rate limit logic ...
            // (Truncated for brevity, I will copy the existing logic back in the actual tool call)
            // Actually I should just insert the Auth check at the top and keep the rest.
        }

        // ... rest of middleware ...
        // I will copy the full file content to be safe and accurate.
        return response; // Placeholder, I need to match the actual file structure.
    },
    {
        callbacks: {
            authorized: ({ token }) => true, // Let everything pass to middleware function so we can handle 401 vs 307
        },
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
