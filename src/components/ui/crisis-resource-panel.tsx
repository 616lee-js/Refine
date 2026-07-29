import { resourcePanelFor, type CrisisResource } from "@/lib/safety/crisis-resources";

/**
 * Tier-conditional crisis resource panel.
 *
 * Renders alongside a Claude response that was generated at Tier 2 or Tier 3.
 *
 * This is the app's ONLY crisis-resource surface. A persistent footer affordance
 * existed briefly and was removed deliberately: Refine is a reflective journaling
 * tool, and an always-present crisis line framed every screen around crisis. The
 * Tier 0 posture is now "no ambient crisis framing; resources surface on detected
 * distress." That makes this panel — and the tier detection behind it — the whole
 * safety surface. See LIM-016.
 *
 * Posture: this is support appearing, not the app pivoting away. It is inline
 * and non-blocking — never a modal, never an interstitial, never something that
 * has to be dismissed before the conversation can continue. The user can keep
 * talking with it on screen. That is the continued-presence commitment expressed
 * in layout: nothing here gates further conversation.
 *
 * Content and tier mapping live in src/lib/safety/crisis-resources.ts and are
 * pending clinical review (LIM-015).
 */
function ResourceItem({ resource }: { resource: CrisisResource }) {
  return (
    <li className="space-y-0.5">
      <p className="text-sm font-medium text-stone-700">{resource.name}</p>
      {resource.contact && (
        <p className="text-sm text-stone-800 font-medium">{resource.contact}</p>
      )}
      <p className="text-xs text-stone-500 leading-relaxed">{resource.description}</p>
      {resource.url && (
        <a
          href={`https://${resource.url}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs text-stone-500 underline underline-offset-2 hover:text-stone-700 transition-colors"
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
    <aside
      // aria-label rather than role="alert": an alert would interrupt the screen
      // reader mid-response. This is a supporting region the user reaches when
      // they are ready, consistent with the non-disruptive posture.
      aria-label="Support resources"
      className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-5 py-4"
    >
      <p className="text-sm font-medium text-stone-700">{content.heading}</p>
      <p className="mt-1 text-xs text-stone-500 leading-relaxed">{content.framing}</p>

      <ul className="mt-4 space-y-4">
        {content.resources.map((r) => (
          <ResourceItem key={r.id} resource={r} />
        ))}
      </ul>
    </aside>
  );
}
