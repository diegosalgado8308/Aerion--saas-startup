import { Inter, Montserrat, Fira_Code } from "next/font/google";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Header from "@/components/Header";
import { auth } from "@/lib/auth";

// Three-font system: Inter for clean/minimalist body & UI text, Montserrat
// for bold/geometric headings, Fira Code for code/monospace. next/font
// self-hosts these at build time (no runtime request to Google Fonts, no
// layout shift from a late-loading webfont).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-montserrat" });
const firaCode = Fira_Code({ subsets: ["latin"], variable: "--font-fira-code" });

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
    <html lang="en" className={`${inter.variable} ${montserrat.variable} ${firaCode.variable}`}>
      <body>
        <a href="#main-content" className="skip-link">Skip to content</a>
        <Header session={session} />
        <main id="main-content">{children}</main>
        <SpeedInsights />
      </body>
    </html>
  );
}
