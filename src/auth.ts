import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
if (!secret) {
  throw new Error("Missing AUTH_SECRET (or NEXTAUTH_SECRET) for Auth.js.");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret,
});
