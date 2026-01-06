import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default withAuth(
    function middleware(req: NextRequest) {
        const response = NextResponse.next();

        // 1. CSP (Content Security Policy)
        // Adjust 'script-src' etc. as needed for your specific external scripts (e.g. Vercel Analytics, Google etc.)
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

        // Security Headers
        response.headers.set('X-Content-Type-Options', 'nosniff');
        response.headers.set('X-Frame-Options', 'DENY');
        response.headers.set('X-XSS-Protection', '1; mode=block');
        response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

        // HSTS - Force HTTPS (1 year with subdomains)
        response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

        // Permissions-Policy - Disable unnecessary browser features
        response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

        // 2. Rate Limiting
        // Note: Edge Middleware requires external storage (Redis/KV) for effective rate limiting.
        // Current architecture does not support in-memory state sharing across edge nodes.
        // We are skipping implementation to avoid false positives or deployment issues.

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
