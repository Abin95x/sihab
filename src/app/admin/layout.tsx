import type { Metadata } from "next";
import { Montserrat } from "next/font/google";

// Gotham is a licensed font, so admin.module.css falls back to Montserrat — its closest free match.
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={montserrat.variable}>{children}</div>;
}
