import type { Metadata, Viewport } from "next";
import { Inter, Libre_Caslon_Text, Roboto_Condensed } from "next/font/google";
import { connection } from "next/server";
import { site } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const condensed = Roboto_Condensed({ subsets: ["latin"], variable: "--font-condensed", display: "swap" });
const serif = Libre_Caslon_Text({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: site.title, template: "%s — Sihab" },
  description: site.description,
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "light",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Render every page per request so Next.js can stamp the CSP nonce from src/proxy.ts on its scripts.
  // Prerendered pages would have no nonce and their scripts would be blocked.
  await connection();
  return (
    <html lang="en" className={`${inter.variable} ${condensed.variable} ${serif.variable}`}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
