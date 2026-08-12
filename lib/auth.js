import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "client-login",
      name: "Client",
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;

        const client = await prisma.client.findUnique({
          where: { email: credentials.email },
        });
        if (!client) return null;

        const valid = await bcrypt.compare(credentials.password, client.password);
        if (!valid) return null;

        return {
          id: client.id,
          name: client.name,
          email: client.email,
          company: client.company,
          role: "client",
        };
      },
    }),
    Credentials({
      id: "admin-login",
      name: "Admin",
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;

        const admin = await prisma.admin.findUnique({
          where: { email: credentials.email },
        });
        if (!admin) return null;

        const valid = await bcrypt.compare(credentials.password, admin.password);
        if (!valid) return null;

        return {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: "admin",
        };
      },
    }),
  ],
});
