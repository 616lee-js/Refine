import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { clearSnapshots } from "./actions";

/**
 * The parts both sections of the evaluations page draw with.
 *
 * Summaries and reports are judged on different questions but read the same
 * way, so the row chrome, the answer pills and the aggregate table are shared.
 * What differs — which questions, which columns — is passed in.
 */

/**
 * One rubric answer.
 *
 * `null` is "there was nothing to judge" and is never shown as a pass. On the
 * report rubric that is the difference between a report that hedged correctly
 * and one that never mentioned a condition at all.
 */
export function Answer({ label, value }: { label: string; value: boolean | null }) {
  const none = value === null;
  return (
    <span
      className="rounded-full"
      style={{
        padding: "3px 9px",
        fontSize: "10.5px",
        color: none
          ? "var(--rf-text-4)"
          : value
            ? "var(--rf-accent-2)"
            : "var(--color-error)",
        background: none
          ? "transparent"
          : value
            ? "var(--rf-accent-2-soft)"
            : "var(--rf-error-soft)",
        boxShadow: none ? "inset 0 0 0 1px var(--rf-border)" : "none",
      }}
    >
      {label}
      {none ? " n/a" : value ? " ✓" : " ✕"}
    </span>
  );
}

export function Rating({ value }: { value: number }) {
  return (
    <span
      className="rounded-full font-mono"
      style={{
        padding: "3px 9px",
        fontSize: "11px",
        color: "var(--rf-paper)",
        background:
          value >= 4
            ? "var(--rf-accent-2)"
            : value <= 2
              ? "var(--color-error)"
              : "var(--rf-text-3)",
      }}
    >
      {value}/5
    </span>
  );
}

export function Snapshot({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  return (
    <details className="mt-2">
      <summary
        className="cursor-pointer list-none py-1"
        style={{ fontSize: "11.5px", color: "var(--rf-admin)" }}
      >
        {title}
      </summary>
      <p
        className="mt-1 max-h-[320px] overflow-y-auto whitespace-pre-wrap rounded-[4px] px-3 py-2"
        style={{
          fontSize: "12.5px",
          lineHeight: 1.6,
          color: "var(--rf-text-2)",
          background: "var(--rf-surface)",
        }}
      >
        {text}
      </p>
    </details>
  );
}

export function Meta({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="font-mono"
      style={{ fontSize: "10.5px", color: "var(--rf-text-4)" }}
    >
      {children}
    </span>
  );
}

export function DestroyButton({ id, kind }: { id: string; kind: "summary" | "report" }) {
  return (
    <form action={clearSnapshots}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="scope" value="one" />
      <button
        type="submit"
        className="rounded-full transition-colors"
        style={{
          padding: "4px 11px",
          fontSize: "11px",
          color: "var(--color-error)",
          boxShadow: "inset 0 0 0 1px var(--rf-border-strong)",
        }}
      >
        Destroy content
      </button>
    </form>
  );
}

export function NoContentNote({ cleared }: { cleared: Date | null }) {
  if (cleared) return null;
  return (
    <p className="mt-2" style={{ fontSize: "11.5px", color: "var(--rf-text-4)" }}>
      No content captured — copies were switched off when this was submitted.
    </p>
  );
}

export function Notes({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p
      className="mt-3 whitespace-pre-wrap"
      style={{ fontSize: "13.5px", lineHeight: 1.6, color: "var(--rf-text)" }}
    >
      {text}
    </p>
  );
}

/**
 * Failures per version. The whole reason the rubric columns are plaintext.
 *
 * Every column counts what went WRONG, so a rising number is a worse model and
 * never a better one. `columns` names the rubric; `rows` supplies the counts.
 */
export function Aggregates({
  heading,
  columns,
  rows,
}: {
  heading: string;
  columns: string[];
  rows: { version: string; n: number; mean: number; failures: number[] }[];
}) {
  if (rows.length === 0) return null;
  return (
    <Sheet className="mb-4 px-5 py-4">
      <Eyebrow size={9.5}>{heading}</Eyebrow>
      <div className="mt-3 overflow-x-auto">
        <table style={{ fontSize: "12px", width: "100%" }}>
          <thead>
            <tr style={{ color: "var(--rf-text-4)" }}>
              <th className="pb-1 pr-4 text-left font-normal">Version</th>
              <th className="pb-1 pr-3 text-right font-normal">n</th>
              <th className="pb-1 pr-3 text-right font-normal">mean</th>
              {columns.map((c) => (
                <th key={c} className="pb-1 pr-3 text-right font-normal">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.version} style={{ borderTop: "1px solid var(--rf-rule)" }}>
                <td
                  className="py-[6px] pr-4 font-mono"
                  style={{ fontSize: "10.5px", color: "var(--rf-text-2)" }}
                >
                  {r.version}
                </td>
                <td className="py-[6px] pr-3 text-right">{r.n}</td>
                <td className="py-[6px] pr-3 text-right">{r.mean.toFixed(1)}</td>
                {r.failures.map((f, i) => (
                  <td key={i} className="py-[6px] pr-3 text-right">
                    {f}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Sheet>
  );
}

export function SectionHeading({
  title,
  count,
  note,
  exportPath,
}: {
  title: string;
  count: number;
  note: string;
  /** ?kind is fixed; format is chosen by the two links. */
  exportPath: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "21px",
            fontWeight: 380,
            color: "var(--rf-text)",
          }}
        >
          {title}
        </h2>
        <p
          className="mt-1 max-w-[520px]"
          style={{ fontSize: "12.5px", lineHeight: 1.55, color: "var(--rf-text-3)" }}
        >
          {count} {count === 1 ? "assessment" : "assessments"}. {note}
        </p>
      </div>

      {/* Exports gate themselves; these are links, not authorisation. */}
      <div className="flex flex-wrap gap-2">
        <a
          href={`${exportPath}&format=csv`}
          className="rounded-full transition-colors"
          style={{
            padding: "6px 13px",
            fontSize: "12px",
            color: "var(--rf-admin)",
            boxShadow: "inset 0 0 0 1px var(--rf-admin-border)",
          }}
        >
          CSV (ratings only)
        </a>
        <a
          href={`${exportPath}&format=json`}
          className="rounded-full transition-colors"
          style={{
            padding: "6px 13px",
            fontSize: "12px",
            color: "var(--rf-admin)",
            boxShadow: "inset 0 0 0 1px var(--rf-admin-border)",
          }}
        >
          JSON (with content)
        </a>
      </div>
    </div>
  );
}
