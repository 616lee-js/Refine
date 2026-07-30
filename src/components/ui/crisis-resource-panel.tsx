import { resourcePanelFor, type CrisisResource } from "@/lib/safety/crisis-resources";
import { Sheet, Eyebrow } from "./sheet";

/**
 * Tier-conditional crisis resources.
 *
 * Renders below the entry once it has been set down, and only when the
 * classifier returned Tier 2 or 3. Tiers 0 and 1 render nothing — Tier 1
 * explicitly does not pivot to resources.
 *
 * ── It is the app's only resource surface ─────────────────────────────────────
 * A persistent crisis-line footer existed briefly and was removed: an
 * always-present crisis affordance framed every screen around crisis, which is
 * wrong for a journalling tool. The consequence is that this panel, and the tier
 * detection behind it, carry the whole safety surface. See LIM-016.
 *
 * ── Dawn treatment ────────────────────────────────────────────────────────────
 * On paper, in the warm palette, with the same sheet the entry sits on. No red,
 * no warning iconography, no urgency styling. It must not read as a clinical
 * alert — the person has just written something hard, and being met with an
 * alarm is the opposite of what the continued-presence commitment promises. The
 * content carries the weight; the chrome stays quiet.
 *
 * `aria-label`, not `role="alert"`: an alert interrupts a screen reader. This is
 * a region reached when ready.
 */
function ResourceItem({ resource }: { resource: CrisisResource }) {
  return (
    <li className="space-y-1">
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "16px",
          lineHeight: 1.4,
          color: "var(--rf-text)",
        }}
      >
        {resource.name}
      </p>
      {resource.contact && (
        <p
          style={{
            fontSize: "13.5px",
            fontWeight: 500,
            color: "var(--rf-text)",
          }}
        >
          {resource.contact}
        </p>
      )}
      <p
        style={{
          fontSize: "12.5px",
          lineHeight: 1.55,
          color: "var(--rf-text-3)",
        }}
      >
        {resource.description}
      </p>
      {resource.url && (
        <a
          href={`https://${resource.url}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block transition-colors hover:!text-[var(--rf-text)]"
          style={{
            fontSize: "12.5px",
            color: "var(--rf-text-3)",
            borderBottom: "1px solid var(--rf-border-strong)",
            paddingBottom: "1px",
          }}
        >
          {resource.url}
        </a>
      )}
    </li>
  );
}

export function CrisisResourcePanel({ tier }: { tier: number }) {
  const content = resourcePanelFor(tier);
  if (!content) return null;

  return (
    <Sheet
      as="section"
      className="mt-5 px-[34px] pb-[24px] pt-[22px]"
    >
      <Eyebrow size={9.5}>Alongside this</Eyebrow>

      <p
        className="mt-[10px]"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "18px",
          lineHeight: 1.45,
          color: "var(--rf-text)",
          maxWidth: 460,
        }}
      >
        {content.heading}
      </p>
      <p
        className="mt-[6px]"
        style={{
          fontSize: "12.5px",
          lineHeight: 1.6,
          color: "var(--rf-text-3)",
          maxWidth: 460,
        }}
      >
        {content.framing}
      </p>

      <ul className="mt-6 flex flex-col gap-5">
        {content.resources.map((r) => (
          <ResourceItem key={r.id} resource={r} />
        ))}
      </ul>
    </Sheet>
  );
}
