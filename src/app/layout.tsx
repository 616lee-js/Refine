import type { Metadata } from "next";
import { Newsreader, Geist, Geist_Mono } from "next/font/google";
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
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
