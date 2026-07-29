/**
 * Every Layer 2 / Layer 3 fragment carries a header line of the form:
 *
 *   # Version: v1 — 2026-05-06
 *
 * Parsing it means the version recorded against a call is the version that was
 * actually loaded, rather than a literal that has to be remembered and updated
 * by hand. Editing a prompt and bumping its header is now enough to make old and
 * new rows distinguishable in safety_log.
 *
 * Returns e.g. "v1@2026-05-06", or "unversioned" when the header is absent.
 */
export function promptVersion(source: string): string {
  const match = source.match(/^#\s*Version:\s*(.+)$/m);
  if (!match) return "unversioned";

  // Separator is an em dash in the current files; accept en dash and hyphen too.
  // Whitespace on BOTH sides is required so that the hyphens inside an ISO date
  // ("2026-05-05") are not mistaken for the separator — without this, the version
  // silently truncates to "v1@2026".
  const parts = match[1].trim().split(/\s+[—–-]\s+/);
  const label = parts[0]?.trim();
  const date = parts[1]?.trim();

  if (!label) return "unversioned";
  return date ? `${label}@${date}` : label;
}
