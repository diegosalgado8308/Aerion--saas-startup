export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.workspaceId = user.workspaceId;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (token?.id) session.user.id = token.id;
      if (token?.workspaceId) session.user.workspaceId = token.workspaceId;
      if (token?.role) session.user.role = token.role;
      return session;
    },
  },
};
