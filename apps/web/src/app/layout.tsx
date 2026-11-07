import type { Metadata, Viewport } from "next";
import "@fontsource-variable/instrument-sans";
import "./globals.css";
import { env } from "@/lib/env";

// Every page is rendered per request so it can carry the per-request CSP nonce
// (and nearly every page depends on the signed-in user anyway).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: `${env.companyName} Careers`, template: `%s | ${env.companyName} Careers` },
  description: `Explore open positions at ${env.companyName} and apply online.`,
};

export const viewport: Viewport = { themeColor: "#0E2A47", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
