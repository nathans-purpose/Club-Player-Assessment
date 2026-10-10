import type { Metadata } from "next";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { t } from "@/lib/i18n";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Fallback for a club's licensed display font until its file is uploaded:
// the width axis covers condensed and extended faces (spec §7.2).
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Bedöm klubbens spelare tillsammans med de andra ledarna.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="sv" className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <footer className="mt-auto border-t border-border">
          <nav
            aria-label={t("footer.label", "Om tjänsten")}
            className="mx-auto flex max-w-6xl flex-wrap gap-x-2 px-4 py-2 text-sm text-muted"
          >
            <Link href="/integritet" className="inline-flex min-h-11 items-center px-2 underline">
              {t("footer.privacy", "Integritet")}
            </Link>
            <Link href="/villkor" className="inline-flex min-h-11 items-center px-2 underline">
              {t("footer.terms", "Villkor")}
            </Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}
