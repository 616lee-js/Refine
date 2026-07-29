import type { NextRequest } from "next/server";

/**
 * Absolute origin of the incoming request, with the protocol the *browser*
 * actually used.
 *
 * ── The bug this fixes ────────────────────────────────────────────────────────
 * The auth routes built redirect URLs as `http://${host}`. That is correct
 * locally and wrong the moment the app is served over HTTPS: form submissions
 * redirected the browser to an http:// URL, and Chrome then warns "The
 * information you're about to submit is not secure" on the next form — on a
 * signup page carrying a password.
 *
 * Vercel terminates TLS at the edge, so the request reaching the function is
 * plain HTTP and `host` alone cannot tell you the protocol. `x-forwarded-proto`
 * carries what the browser used.
 *
 * Falls back to http only for localhost, and https otherwise — so a missing
 * header on a deployed host degrades to secure rather than insecure.
 */
export function requestOrigin(req: NextRequest): string {
  // x-forwarded-host wins when present: behind a proxy, `host` can be internal.
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";

  // The header can be a comma-separated chain ("https,http") — the first entry
  // is the client-facing protocol.
  const forwarded = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();

  const isLocal =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("[::1]");

  const proto = forwarded || (isLocal ? "http" : "https");

  return `${proto}://${host}`;
}
