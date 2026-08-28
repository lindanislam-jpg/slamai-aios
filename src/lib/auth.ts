import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "./db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = (credentials.email as string).trim();
        // New accounts are stored lowercase; fall back to the address as typed
        // so accounts created before that change still sign in.
        const user =
          (await db.user.findUnique({ where: { email: email.toLowerCase() } })) ??
          (await db.user.findUnique({ where: { email } }));
        if (!user || !user.password) return null;
        const valid = await bcrypt.compare(credentials.password as string, user.password);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role, plan: user.plan };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id   = user.id;
        token.role = (user as { role?: string }).role;
        token.plan = (user as { plan?: string }).plan;
      }
      // Lets the settings page push a renamed profile into the existing token.
      if (trigger === "update" && (session as { name?: string })?.name) {
        token.name = (session as { name?: string }).name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id   = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { plan?: string }).plan = token.plan as string;
      }
      return session;
    },
  },
});
