import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Header from "@/components/Header";
import { auth } from "@/lib/auth";

export const metadata = {
  title: {
    default: "Aerion Software — Project & task management",
    template: "%s — Aerion Software",
  },
  description: "Simple project and task management for small teams.",
};

export default async function RootLayout({ children }) {
  const session = await auth();

  return (
    <html lang="en">
      <body>
        <Header session={session} />
        <main>{children}</main>
        <SpeedInsights />
      </body>
    </html>
  );
}
