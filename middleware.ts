import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default withAuth(
    function middleware(req: NextRequest) {
        const response = NextResponse.next();

        // Security Headers
        response.headers.set('X-Content-Type-Options', 'nosniff');
        response.headers.set('X-Frame-Options', 'DENY');
        response.headers.set('X-XSS-Protection', '1; mode=block');
        response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

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
    ],
};
