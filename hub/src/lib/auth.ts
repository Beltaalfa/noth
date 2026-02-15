import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import { logAudit } from "./audit";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) return null;

          const user = await prisma.user.findFirst({
            where: {
              email: String(credentials.email),
              deletedAt: null,
            },
          });

          if (!user || user.status !== "active") return null;

          const valid = await bcrypt.compare(String(credentials.password), user.passwordHash);
          if (!valid) return null;

          try {
            await logAudit({
              userId: user.id,
              action: "login",
              entity: "User",
              entityId: user.id,
              details: user.email,
            });
          } catch {
            // não bloqueia login se o log falhar
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login?error=config",
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
});
