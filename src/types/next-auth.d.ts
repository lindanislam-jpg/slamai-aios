import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
    plan?: string;
  }

  interface Session {
    user: {
      id: string;
      role?: string;
      plan?: string;
    } & DefaultSession["user"];
  }
}

// `next-auth/jwt` only re-exports (`export *`) from @auth/core/jwt, so the
// augmentation has to target the module that actually declares JWT.
declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    plan?: string;
  }
}
