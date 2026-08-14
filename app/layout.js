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
        <a href="#main-content" className="skip-link">Skip to content</a>
        <Header session={session} />
        <main id="main-content">{children}</main>
        <SpeedInsights />
      </body>
    </html>
  );
}
