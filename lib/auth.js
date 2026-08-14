import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifyCredentials } from "@/lib/workspace";
import { authConfig } from "@/lib/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await verifyCredentials(credentials.email.toString(), credentials.password.toString());
        if (!user) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          workspaceId: user.workspaceId,
          role: user.role,
        };
      },
    }),
  ],
});
