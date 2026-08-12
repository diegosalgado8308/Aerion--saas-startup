import { Orbitron } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { auth } from "@/lib/auth";

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-orbitron",
});

export const metadata = {
  title: {
    default: "Aerion Software — Custom Software & Product Engineering",
    template: "%s — Aerion Software",
  },
  description: "Aerion Software designs, builds, and scales custom software and SaaS products for ambitious teams.",
};

export default async function RootLayout({ children }) {
  const session = await auth();

  return (
    <html lang="en" className={orbitron.variable}>
      <body>
        <Header session={session} />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
