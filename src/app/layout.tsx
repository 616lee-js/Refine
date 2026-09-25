import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Newsreader, Geist, Geist_Mono } from "next/font/google";
import {
  MODE_COOKIE,
  PALETTE_COOKIE,
  readMode,
  readPalette,
} from "@/lib/appearance";
import "./globals.css";

/**
 * Self-hosted via next/font — the files are fetched at build time and served
 * from our own origin, so there is no runtime request to Google and no
 * third-party record of who read a journalling app.
 *
 * `display: "swap"` so text is readable while the face loads; Newsreader is a
 * variable optical-size font, hence the `axes`.
 */
const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-newsreader",
  axes: ["opsz"],
  style: ["normal", "italic"],
});

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Refine",
  description: "Reflective journaling",
};

/**
 * ── Why the palette is decided here ───────────────────────────────────────────
 * Server-rendered onto <html>, from two cookies, so the correct palette is in
 * the markup before any JavaScript runs. Deciding it on the client instead would
 * paint Dawn first and then swap — a flash of the wrong colours on every load,
 * worst for anyone who chose dark.
 *
 * `system` is not resolved here. It is passed through as-is and answered in CSS
 * by a prefers-color-scheme block, so it follows the OS without a reload and
 * without this layout knowing anything about the device.
 *
 * Cookies rather than the user's row: this runs for every request including
 * signed-out ones, and a database read to decide a colour is not worth it. The
 * row stays the truth — login rewrites the cookies from it.
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jar = await cookies();
  const palette = readPalette(jar.get(PALETTE_COOKIE)?.value);
  const mode = readMode(jar.get(MODE_COOKIE)?.value);

  return (
    <html
      lang="en"
      data-palette={palette}
      data-mode={mode}
      className={`${newsreader.variable} ${geist.variable} ${geistMono.variable}`}
    >
      <body
        className="text-text-primary antialiased"
        style={{ background: "var(--rf-bg)", fontFamily: "var(--font-sans)" }}
      >
        {children}
      </body>
    </html>
  );
}
