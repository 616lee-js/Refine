import {
  MAX_PEOPLE,
  MAX_QUOTES,
  MAX_SUMMARY_CHARS,
  MAX_TOPICS,
  type EntrySummary,
  type RawSummary,
  type SummaryQuote,
} from "./types";

/**
 * Parsing and quote-location for summariser output.
 *
 * Split from generate.ts for the same reason src/lib/safety/chunk.ts is split
 * from the classifier: these are the parts most likely to break when a model's
 * output drifts, and they must be testable without an API key, a database, or a
 * bundler that can turn a .md file into a string.
 *
 * Everything here treats model output as untrusted input. It is.
 */

export class SummaryGenerationError extends Error {}

/** Strips a ```json fence if the model adds one despite being told not to. */
export function unfence(raw: string): string {
  const fenced = raw.match(/^```(?:json)?\s*\n([\s\S]*?)\n?```$/);
  return (fenced ? fenced[1] : raw).trim();
}

function asStringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .slice(0, limit);
}

/**
 * Locates each quote in the body.
 *
 * Offsets come from indexOf, never from the model — an LLM cannot count
 * characters reliably, and a wrong offset is worse than no offset because it
 * silently points at the wrong words.
 *
 * A quote that cannot be found comes back with a null offset. This function
 * does not drop it — it is also the validator behind user-curated quotes, where
 * the caller wants to know *which* one failed. `refineQuotes()` below is what
 * drops unlocatable model output.
 */
export function locate(quotes: string[], body: string): SummaryQuote[] {
  return quotes.map((text) => {
    const exact = body.indexOf(text);
    if (exact !== -1) return { text, offset: exact };

    // Second chance on whitespace-normalised text: models routinely collapse a
    // line break inside a sentence they are otherwise copying exactly.
    const normalised = text.replace(/\s+/g, " ").trim();
    const flatBody = body.replace(/\s+/g, " ");
    const approx = flatBody.indexOf(normalised);
    return { text, offset: approx === -1 ? null : approx };
  });
}

/** Under this many words a "quote" is a fragment, not a line. */
export const MIN_QUOTE_WORDS = 4;
/** Over this a "quote" is a paragraph. */
export const MAX_QUOTE_CHARS = 220;

const flatten = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Deterministic quality pass over the model's quote picks.
 *
 * The summariser has been returning quotes that are inconsistent and not
 * notable. The prompt is the real lever and is under review; this is the part
 * that needs no prompt change and catches the mechanical failures:
 *
 * - **Unlocatable.** Not found even after whitespace normalisation means the
 *   model paraphrased. A quote the writer cannot be shown in their own text is
 *   not their words, and "verbatim" is the only guarantee that makes quotes
 *   worth storing. (Previously kept with a null offset; dropped since
 *   2026-09-21.)
 * - **Too short.** Under MIN_QUOTE_WORDS it is a phrase, and the model's habit
 *   of quoting two-word topic labels is what made the section feel random.
 * - **Too long.** Over MAX_QUOTE_CHARS it is the entry again, not a line from it.
 * - **The whole entry.** A short entry quoted in full is padding.
 * - **Duplicates**, and quotes contained in another quote already kept.
 *
 * Order is preserved: the model lists what it thinks matters most first.
 */
export function refineQuotes(quotes: SummaryQuote[], body: string): SummaryQuote[] {
  const flatBody = flatten(body);
  const kept: SummaryQuote[] = [];

  for (const q of quotes) {
    if (q.offset === null) continue;
    const flat = flatten(q.text);
    if (flat.length === 0 || flat.length > MAX_QUOTE_CHARS) continue;
    if (flat.split(" ").length < MIN_QUOTE_WORDS) continue;
    if (flat === flatBody) continue;
    if (kept.some((k) => flatten(k.text).includes(flat))) continue;
    kept.push(q);
  }

  return kept;
}

export function parse(raw: string, body: string): EntrySummary {
  let parsed: unknown;
  try {
    parsed = JSON.parse(unfence(raw));
  } catch {
    throw new SummaryGenerationError("Model did not return JSON");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new SummaryGenerationError("Model returned a non-object");
  }

  const obj = parsed as Partial<RawSummary>;

  // A summary with no prose is a failed generation, not a thin one — `thin` is
  // for entries with little in them, and even those get a sentence.
  if (typeof obj.summary !== "string" || !obj.summary.trim()) {
    throw new SummaryGenerationError("Model returned no summary text");
  }

  return {
    summary: obj.summary.trim().slice(0, MAX_SUMMARY_CHARS),
    topics: asStringArray(obj.topics, MAX_TOPICS),
    people: asStringArray(obj.people, MAX_PEOPLE),
    // Located, then refined, then capped — the cap applies after the weak
    // picks are gone, so a bad first pick does not cost a good fourth one.
    quotes: refineQuotes(
      locate(asStringArray(obj.quotes, MAX_QUOTES * 2), body),
      body
    ).slice(0, MAX_QUOTES),
    // Absent means false, but an entry short enough to be thin is also short
    // enough to detect here, so it is not left entirely to the model.
    thin: obj.thin === true || body.trim().length < 120,
  };
}

