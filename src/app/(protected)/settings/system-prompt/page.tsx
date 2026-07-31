import Link from "next/link";
import systemPrompt from "@/lib/layer2/system-prompt.md";
import { PageBg } from "@/components/ui/page-bg";
import { Sheet, Eyebrow } from "@/components/ui/sheet";
import { TopNav } from "@/components/ui/top-nav";
import { AdminNav } from "@/components/ui/admin-nav";

/**
 * Read-only view of the Layer 2 system prompt.
 *
 * This exists because of the transparency principle: users understand what the
 * AI is instructed to do. Read-only by design — the prompt is not user-editable.
 *
 * Scope is Layer 2 only, which is what the planning doc commits to. Layer 3
 * clinical reference fragments (tier protocols, crisis resources) are a separate
 * question and are deliberately not surfaced here.
 *
 * CONTENT PASS: the framing below describes instructions given "at the start of
 * every reflection", which was true of the conversational model and is not true
 * now — nothing in the journal surface invokes Claude. The page still tells the
 * truth about what Claude is instructed to do *when* it is invoked, but it will
 * read oddly to someone who never sees Claude respond.
 */
export default function SystemPromptPage() {
  return (
    <PageBg>
      <TopNav active="profile" admin={<AdminNav />} />

      <div className="flex min-h-0 flex-1 justify-center px-6 pt-[26px] sm:px-10">
        <div className="w-full pb-14" style={{ maxWidth: 700 }}>
          <Eyebrow>Transparency</Eyebrow>
          <h1
            className="mb-[10px] mt-[9px]"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "30px",
              fontWeight: 380,
              letterSpacing: "-0.02em",
              color: "var(--rf-text)",
            }}
          >
            The system prompt
          </h1>

          <div
            className="flex max-w-[560px] flex-col gap-[10px]"
            style={{ fontSize: "13px", lineHeight: 1.65, color: "var(--rf-text-3)" }}
          >
            <p>
              The standing instructions Claude is given. They are the same for
              everyone and do not change based on what you write.
            </p>
            <p>
              Shown so you can see what shapes anything Claude produces. It is
              read-only — you can&apos;t edit it, and neither can Claude.
            </p>
            <p>
              Separately, Claude receives your profile and anything you have kept
              in{" "}
              <Link
                href="/mirror"
                className="underline underline-offset-2"
                style={{ color: "var(--rf-text-2)" }}
              >
                Mirror
              </Link>
              . Those are yours to edit or delete at any time.
            </p>
          </div>

          <Sheet className="mt-6 px-5 py-5 sm:px-7">
            {/* overflow-x-auto so a long unbroken line scrolls inside the sheet
                rather than widening the page on a narrow screen. */}
            <div className="overflow-x-auto">
              <pre
                className="whitespace-pre-wrap break-words font-mono"
                style={{
                  fontSize: "12px",
                  lineHeight: 1.7,
                  color: "var(--rf-text-2)",
                }}
              >
                {systemPrompt}
              </pre>
            </div>
          </Sheet>

          <div className="pt-[14px]">
            <Link
              href="/settings/profile"
              className="font-mono uppercase"
              style={{
                fontSize: "9.5px",
                letterSpacing: "0.14em",
                color: "var(--rf-text-4)",
              }}
            >
              ← Profile
            </Link>
          </div>
        </div>
      </div>
    </PageBg>
  );
}
