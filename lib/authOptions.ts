import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                username: { label: "Username", type: "text", placeholder: "admin" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.username || !credentials?.password) return null;

                const user = await prisma.user.findUnique({
                    where: { username: credentials.username }
                });

                if (!user) return null;

                const isValid = await bcrypt.compare(credentials.password, user.password);

                if (!isValid) return null;

                return {
                    id: user.id,
                    name: user.name,
                    email: user.username, // Using username as email for NextAuth compatibility if needed
                    image: user.image,
                    role: user.role
                };
            }
        })
    ],
    callbacks: {
        async jwt({ token, user, trigger, session }) {
            if (user) {
                token.role = user.role;
                token.id = user.id;
                token.image = user.image;
            }
            if (trigger === "update" && session?.name) {
                token.name = session.name;
            }
            if (trigger === "update" && session?.image) {
                token.image = session.image;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.role = token.role;
                session.user.id = token.id;
                session.user.image = token.image as string;
            }
            return session;
        }
    },
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
        maxAge: 7 * 24 * 60 * 60, // 7 days (reduced from default 30 days for security)
    }
};
