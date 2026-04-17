import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const emailRaw = credentials?.email;
        const passwordRaw = credentials?.password;
        if (typeof emailRaw !== "string" || typeof passwordRaw !== "string") {
          return null;
        }
        const { prisma } = await import("@/lib/prisma");
        const bcrypt = (await import("bcryptjs")).default;
        const email = emailRaw.toLowerCase().trim();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.password) {
          return null;
        }
        const valid = await bcrypt.compare(passwordRaw, user.password);
        if (!valid) {
          return null;
        }
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
