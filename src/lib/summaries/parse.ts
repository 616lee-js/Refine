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
 * A quote that cannot be found is KEPT with a null offset rather than dropped.
 * Near-verbatim is still the writer's phrasing and still useful to a thread
 * summary; only the "jump to this point in the entry" affordance is lost.
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
    quotes: locate(asStringArray(obj.quotes, MAX_QUOTES), body),
    // Absent means false, but an entry short enough to be thin is also short
    // enough to detect here, so it is not left entirely to the model.
    thin: obj.thin === true || body.trim().length < 120,
  };
}

