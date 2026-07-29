# Refine — Known Issues and Limitations

A living register of issues, limitations, and known constraints of the app. Maintained throughout the build. Used to inform iteration priorities, transparency in user-facing communications, and eventual decisions about what's appropriate to communicate to users about the app's nature.

---

## Why this document exists

Three purposes:

**Honest internal awareness.** No product is without limits. Naming them keeps decision-making grounded. A list of limitations protects against over-claiming, both internally (when scope-expanding instincts arise) and externally (when describing the app to users, clinicians, or collaborators).

**Iteration prioritization.** Not every limitation is equally important. The list helps surface which issues actually block users, which are minor friction, and which are inherent constraints that won't be fixed but should be acknowledged.

**User-facing transparency.** The app's transparency commitments (visible system prompt, editable memory, honest disclosure about AI involvement) require knowing what to be honest about. The list informs the language used in onboarding, in disclaimers, and in any external description of the app.

---

## How to use this document

- **Add issues as they're encountered.** Don't wait for a formal review. Capture freshly.
- **Categorize loosely.** Categories below are starting points; add or change as patterns emerge.
- **Tag severity, not as a strict ranking.** "Blocker," "Significant," "Minor," "Inherent" are useful starting tags. Adjust as needed.
- **Note status.** "Open," "Mitigated," "Accepted as inherent," "Resolved." Mitigated and inherent are different — mitigated means partially addressed but not eliminated; inherent means won't be fully fixed because it's a property of the approach.
- **Keep it scannable.** This is a working document, not an essay. Brief entries are fine.
- **Review before each phase transition.** What's been resolved? What's been added? What needs to be addressed before the next phase or before users arrive?

---

## Categories

Adjust as needed.

- **AI / model limitations** — limits inherent to using language models for this work
- **Architectural limitations** — limits of the technical approach
- **Scope limitations** — things deliberately not built (linked to v1 non-goals)
- **Usability issues** — friction in actual use
- **Workflow issues** — multi-step processes that don't flow well
- **Safety concerns** — places where the safety architecture may not be enough
- **Privacy concerns** — places where the privacy commitments may be tested
- **Cultural / accessibility limitations** — assumptions baked in about who the app serves

---

## Known limitations (starting set — to be expanded)

The items below are limitations identified during planning that exist by design or by current scope. Add new ones as discovered.

---

### Infrastructure limitations

#### LIM-017 — Pinned Supabase CA was not verified against the authenticated dashboard

**Severity:** Low-moderate — affects trust provenance, not current connection security
**Status:** Accepted 2026-07-29; upgrade opportunistically

Supabase serves its Postgres endpoints from its own private CA (`Supabase Root 2021 CA`, self-signed), not a publicly-trusted one. This was verified empirically: every TLS configuration that checks the system trust store fails with `SELF_SIGNED_CERT_IN_CHAIN`, including `ssl: true`, `sslmode=require`, and `sslmode=verify-full`. Only two configurations connect — one that does not encrypt at all, and one that encrypts without verifying the peer. Pinning the CA is therefore the only route to verified TLS, and it is stronger than the system store: exactly one issuer is accepted.

The certificate is pinned in `src/lib/db/supabase-ca.ts` and used by both the app pool and drizzle migrations. A live connection using it verifies successfully (`authorized: true`, TLS_AES_256_GCM_SHA384).

**The limitation:** its provenance was established by fingerprint agreement between two sources — the root presented by the live pooler connection, and the certificate published at Supabase's public download bucket. They are byte-identical:

```
80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA
Supabase Root 2021 CA — valid 2021-04-28 -> 2031-04-26
```

It was **not** confirmed against the authenticated Supabase dashboard, which is the authoritative source. TLS proves the download bucket is the S3 bucket it claims to be; it does not prove Supabase owns that bucket. So both sources could in principle share an origin that was never independently authenticated. The practical risk is low — an attacker would need to control both the live database connection and that bucket — but it is not zero, and it is the trust anchor for a link carrying journal content.

**To close this:** open the SSL section of the Supabase dashboard, compare the SHA-256 above, and delete the provenance paragraph in `src/lib/db/supabase-ca.ts` once it matches.

**Rotation:** expiry is 2031. Node's `ca` option accepts an array, so a replacement root can be added alongside this one before any cutover. Failure is loud rather than silent — connections refuse outright, and the daily `/api/health` cron surfaces it within 24 hours.

---

### Safety architecture limitations

#### LIM-016 — The tier-conditional panel is the only crisis-resource surface

**Severity:** Significant — makes tier-detection accuracy load-bearing for safety
**Status:** Accepted design decision (2026-07-29); requires active monitoring during testing

The persistent crisis-line footer was removed from all authenticated pages. Refine is positioned as an AI-augmented reflective journaling tool, not a crisis-centric mental health app, and an always-present crisis affordance framed every screen — home, Mirror, history, settings — around crisis in a way that contradicts the intended design. The Tier 0 posture is now: **normal reflection carries no ambient crisis framing; resources surface on detected distress.**

**This supersedes the planning doc's Tier 0 specification,** which calls for crisis resources "persistent in the UI... always present, never modal-ing the user." Recorded as a deliberate decision rather than left as drift.

**What this concentrates.** Previously a mis-classified message had a fallback: the user still saw 988 and Crisis Text Line at the bottom of the screen. That fallback is gone. Crisis resources now appear if and only if the classifier returns Tier 2 or Tier 3. A false negative means a user in real distress sees no resources anywhere in the app.

This compounds **LIM-001** (the classifier sees the current message only, without conversation context, so it can under-trigger when prior context would have escalated the signal). Under-triggering was previously a degraded experience; it is now a silent absence.

**Mitigation and what to watch:**
- Every classification is written to `safety_log` with the prompt version that produced it. **Review it regularly during testing** — specifically for false negatives, which are now the failure mode that matters most. The planning doc's standing advice ("don't skip the safety logging") applies with more force than when it was written.
- The panel renders on both normal responses and reflection-closing messages, so a reflection that ends at an elevated tier still surfaces resources on its final message.
- Tier 2 panel content now includes 988 and Crisis Text Line. It briefly did not, on the reasoning that the footer displayed them permanently; removing the footer invalidated that reasoning and they were restored the same day.

**Open question for clinical review:** whether a journaling app with no ambient crisis affordance is appropriate for users who may arrive in distress, or whether some minimal always-available path (a nav item rather than a footer line, for instance) is warranted. This decision was made on product-positioning grounds, not clinical ones.

---

#### LIM-015 — Crisis resource panel content is pending clinician review

**Severity:** Significant — this is safety-surface content shown at Tier 2 and Tier 3
**Status:** Open; blocks nothing structurally, but must be reviewed before the v2 gate and ideally before tester access widens

The tier-conditional crisis resource panel (`src/components/ui/crisis-resource-panel.tsx`, content in `src/lib/safety/crisis-resources.ts`) was built to close a real gap: the Tier 2 and Tier 3 Layer 3 protocols tell Claude that the app renders a resource list and that Claude therefore need not list resources in detail — but until now the app rendered nothing beyond the persistent 988 / Crisis Text Line footer. Resources reached Claude's context and never the user's screen.

**What is not yet reviewed:**

- **The resource list itself.** Transcribed verbatim from `src/lib/layer3/crisis-resources.md`, which describes itself as a v1 starter list pending full curation at the v2 clinical review gate. Nothing was added, removed, or substituted — but a starter list rendered to a user in acute distress carries more weight than a starter list sitting in a prompt.
- **The tier split.** Tier 2 shows the support-oriented subset (SAMHSA, warmlines, sliding-scale directories) on the reasoning that 988 and Crisis Text Line are already persistently visible in the footer on the same screen. Tier 3 shows the full set, crisis lines first. This division was an implementation judgment, not a clinical one.
- **The framing copy.** The panel headings and the one-line framing above each list were written to match the protocols' continued-presence posture ("no pressure to use any of these," "this is bigger than what this app can hold"). A clinician should confirm the wording does not read as dismissal at Tier 3 or as alarm at Tier 2.
- **US-only.** Every resource is US-specific, inheriting LIM-007's English-only and US-centric assumptions. A user outside the US in acute distress is shown numbers they cannot call.

**Mitigation:** resource data is structured as typed records in a single module, separate from both the rendering component and the Layer 3 prompt fragment, so a reviewer can change entries, categories, and tier membership without touching UI code. The Layer 3 fragment and this module must be kept in agreement — the protocols' claim that "the rendered list is the source of truth" is only honest while they match.

---

### AI / model limitations

#### LIM-001 — Tier classifier sees current message only, not conversation context

**Severity:** Significant
**Status:** Accepted as inherent for v1; revisit at v2

The tier classifier (Haiku) classifies each user message in isolation, without conversation history. This is necessary for cost, latency, and evaluability reasons but means the classifier can over-trigger when context would have de-escalated the signal, or under-trigger when the same words are more concerning given prior session content.

The main response generator (Sonnet) does have full conversation context, which partially compensates — even when the classifier over-triggers, the response is generated with appropriate context.

**Implication for users:** Some messages may be classified at a higher tier than the user's actual situation warrants, leading to a moment of resource-surfacing that feels disproportionate. The continued-presence design mitigates this — Claude doesn't pivot away — but the user may still feel briefly pathologized.

**Future revisit:** May be worth giving the classifier limited recent context at v2.

---

#### LIM-002 — System cannot verify user-stated diagnostic context

**Severity:** Significant
**Status:** Accepted as inherent

When a user says they have a particular diagnosis (formal or self-reported), the app cannot verify this. The system treats user-stated context as user-provided context, not as fact. This is the right approach but means:

- A user could claim a clinician told them something the clinician didn't.
- A user could self-diagnose inaccurately and the app would adopt that frame as context.
- The line between "honoring the user's self-knowledge" and "reinforcing potentially inaccurate frames" is genuinely subtle.

**Mitigation in design:** The system uses diagnostic context as input but doesn't adopt it as the interpretive lens for everything. The principle is "informed by, not framed by."

**Future revisit:** Clinician-verified linkage is a possible v2+ feature but is not currently planned.

---

#### LIM-003 — Pattern recognition can produce false positives

**Severity:** Significant
**Status:** Mitigated through negative testing; ongoing concern

The longitudinal feature (v1.5+) can manufacture patterns from noise — finding apparent connections in data where no real pattern exists. This is an inherent risk of any synthesis-on-data system, and the more sophisticated the synthesis, the easier it is to produce horoscope-like output.

**Mitigation:** Negative testing against personas with no coherent pattern is the primary defense. Required before any longitudinal output reaches users.

**User-facing implication:** Users should understand that surfaced patterns are observations, not facts about them. The disclaimer language and the "grounded in specific entries" requirement (insights traceable to source) help users evaluate.

---

### Architectural limitations

#### LIM-004 — Auth functionality deferred to v2

**Severity:** Minor for solo local use; significant before multi-user or shared deployment
**Status:** Mitigated in v1; remainder deferred to v2

Phase 3 added email/password auth (bcrypt password hashing, HMAC-indexed encrypted email, iron-session encrypted cookies). This replaces the passphrase approach from earlier phases.

What is still deferred to v2: email verification, login rate limiting and brute-force protection, MFA, and a user-facing account deletion UI. These are not needed for the solo local v1 use case but are required before any multi-user or shared-access deployment.

---

#### LIM-010 — iron-session does not support individual session revocation

**Severity:** Minor for solo local use; significant before multi-user deployment
**Status:** Accepted for v1; revisit at v2

iron-session stores session state in an encrypted cookie — there is no server-side session table. This means individual sessions cannot be revoked (e.g., "log out this device"). The only way to invalidate all active sessions is to rotate `SESSION_SECRET`, which makes all existing cookies unreadable.

For solo local v1 use this is acceptable. Before multi-user deployment or any shared-access scenario, replace iron-session with DB-backed sessions (sessions table with a revocation flag).

---

#### LIM-011 — Audio recordings stored unencrypted on disk in v1

**Severity:** Significant (privacy)
**Status:** Accepted for v1 solo local use; must resolve before v2

Voice session audio is saved to `./audio/[reflectionId]/[uuid].webm` in plain binary — no AES-GCM encryption. The `audio/` directory is `.gitignore`d. Contrast with text entries, which are AES-256-GCM encrypted at rest. On a solo local machine this is low risk; before any shared-server or cloud deployment, audio must be encrypted at the application layer (or via filesystem encryption).

**Future:** Encrypt audio files at rest using the same key derivation as entry content, or use filesystem-level encryption for the audio directory.

---

#### LIM-014 — Cabinet 2 deletion propagation gap

**Severity:** Minor for v1 (Cabinet 2 not yet built); Significant before longitudinal features ship
**Status:** Open; accepted for v1; must address before Phase 6

When a user deletes a memory entry, only the `user_memory` row is hard-deleted. Reflection summaries (Cabinet 2, Phase 6+) are not regenerated after deletion — they may still contain references to, or be shaped by, the deleted entry. If longitudinal synthesis features consume Cabinet 2 data, those references could surface stale context without any indicator that the source was deleted.

**Implication:** In v1, Cabinet 2 does not exist, so no user is affected yet. The risk is forward-looking: if summary regeneration is not added alongside Cabinet 2, deleted memory could ghost into longitudinal insights.

**Future:** When Cabinet 2 is built (Phase 6), design regeneration or invalidation logic for summaries that reference deleted entries. Document as a user-facing transparency item if partial propagation is accepted.

---

#### LIM-013 — Signout auto-end does not generate a closing AI response

**Severity:** Minor
**Status:** Accepted for v1; revisit at v2

When a user signs out with an active reflection, the logout route stamps `endedAt` on all active reflections. The reflection's entries are fully preserved, but no closing AI response is generated — streaming requires an active client connection, which is unavailable during signout. Reflections ended this way will appear as Ended in the history but will not have a closing message from Claude.

Same behavior applies to abandon-on-navigation (tab close, route change without explicit End): the reflection is marked ended but no closing message is written.

The explicit "End reflection" button is the only path that generates a proper closing response.

---

#### LIM-012 — WebSpeech API restart gap loses utterances

**Severity:** Minor
**Status:** Accepted as inherent for Web Speech API v1; mitigated by status indicator

The Web Speech API `SpeechRecognition` object stops silently when the browser detects a pause or network event. The `onend` handler restarts recognition, but there is a brief window (typically <500ms) during which speech is not captured. The UI shows "Restarting microphone…" during this gap. Any words spoken in the gap are lost.

**Mitigation:** The status indicator alerts users. Switching to a push-to-talk model or a continuous server-side provider (Deepgram, Whisper streaming) at v2 would eliminate the gap.

---

#### LIM-005 — Voice transcription via browser Web Speech API in v1

**Severity:** Minor for v1 development; significant for users at v2
**Status:** Mitigated in v1; revisit before v2

Web Speech API is free and requires no additional accounts but has lower transcription accuracy than dedicated providers (Whisper, Deepgram), and Chrome's implementation sends audio to Google for processing. The latter has privacy implications that are acceptable for solo testing but may not meet the PHI-grade rigor commitment for real users.

**v2 requirement:** Re-evaluate transcription provider against privacy commitments before any non-developer users.

---

#### LIM-006 — Cloud deployment brought forward ahead of the v2 gate

**Severity:** Significant — deliberately accepted risk
**Status:** Superseded 2026-07-29. Previously "Local-only deployment through v1 and v1.5."

**What changed.** The original entry recorded that the app runs only on the developer's machine through v1 and v1.5, with cloud deployment handled formally at the v2 gate. That is no longer true. The app is being deployed to Vercel with Supabase Postgres, text-only, to support a small controlled group of invited testers.

**Why this is a limitation and not just a change.** `refine_v1_planning.md` lists cloud deployment as an explicit v1 non-goal ("Local hosting only through v1.5. Cloud is a v2 gate item"), and product principle 10 makes clinical review, privacy and legal review, cloud deployment with proper encryption, and tester consent flows a non-movable gate before any human other than the product owner uses the app. Bringing testers in ahead of that gate means people other than the product owner are using the app before those reviews have happened.

**Risk posture accepted by the product owner:**
- Access is invite-gated — single-use codes, no open signup.
- The tester group is small, known, and constrained.
- The app is not publicly advertised or discoverable.
- Field-level AES-256-GCM encryption is in place, keys are environment-scoped, and no secret is exposed to the browser.

**What is still outstanding.** The v2 gate items are not satisfied and are not claimed to be. In particular, clinical review of the safety architecture, Layer 2 prompt, Layer 3 fragments, tier classification logic, and the crisis resource list has not occurred. The resource list remains a self-described starter list. Privacy/legal review and formal consent flows have not been completed.

**Related deployment-era limitations:** audio capture is disabled and voice is feature-flagged off because serverless has no persistent filesystem (see LIM-011, now moot for the deployed build); background processing for Phase 6 must be serverless-compatible rather than fire-and-forget.

---

### Scope limitations (v1)

These are deliberate v1 non-goals from the planning doc, listed here for cross-reference.

- No longitudinal pattern surfacing in v1 (v1.5)
- No export reports in v1 (v1.5)
- No validated assessments in v1 (v1.5+)
- No personality assessment in v1 (v1.5+ if at all)
- No multi-user support in v1 (v2) — *partially superseded: invite-gated tester accounts exist as of the Vercel deployment; see LIM-006*
- No mobile apps in v1 (potential v2 phase 2)
- No payment / pricing tiers (v2+)
- No product-improvement data pipeline (v2+)

---

### Cultural / accessibility limitations

#### LIM-007 — English-only

**Severity:** Significant for any non-English audience
**Status:** Open; multi-language deferred

The app is built in English only. Claude can converse in many languages but the system prompt, Layer 3 fragments, UI, and resource lists are all English. Users whose first language isn't English would have a degraded experience, including in safety-critical moments where resource lists wouldn't connect them to language-appropriate support.

**Future:** Multi-language support is a real concern but not currently scoped.

---

#### LIM-008 — Cultural assumptions in the design

**Severity:** Significant
**Status:** Open; named in planning doc as ongoing concern

Self-guided growth, MI as a stance, journaling as a practice, structured check-ins, comfort with introspection — these all carry cultural assumptions. Predominantly Western, individualist, language-fluent, with time and emotional bandwidth to sit with feelings.

**Mitigation:** Eventual transparency about who the app is and isn't for. Avoiding overclaiming universality in any user-facing description.

---

#### LIM-009 — Accessibility not fully addressed

**Severity:** TBD
**Status:** Open; should be addressed before v2

Phase 2 build includes "semantic HTML and accessible form labels" as a baseline requirement, but full accessibility (screen reader testing, keyboard-only navigation, color contrast, motion sensitivity, etc.) is not yet scoped. Mental health apps especially have an obligation to be accessible.

**v2 requirement:** Accessibility audit before testers.

---

### Safety concerns (to be populated through use)

This section will accumulate observations during the v1 self-testing period and beyond. Specific places where the four-tier safety architecture may not be enough, edge cases the classifier struggles with, language patterns that confuse the system, etc.

Initial entries to expect:

- Tier classifier accuracy on culturally-specific expressions of distress
- Handling of users who explicitly want to discuss past trauma despite the trauma-out-of-scope principle
- Appropriate response when a user is processing harm done *to* them (vs. harm by/to themselves)
- Handling of disclosed harm to others (e.g., someone in user's life)

---

### Privacy concerns (to be populated through use)

Specific places where the privacy commitments may be tested in practice.

Initial entries to expect:

- Voice data handling specifics under PHI-grade rigor
- Backup and disaster recovery posture vs. deletion guarantees
- Edge cases in genuine deletion (e.g., references to deleted entries in summaries that are themselves part of broader summaries)
- Logging and observability vs. privacy

---

### Usability and workflow issues (to be populated through use)

This section is the active register during the v1 self-testing period. Friction encountered, unclear flows, workflows that take too many steps, etc.

---

## How this document feeds into product transparency

When the time comes to write user-facing onboarding language, disclaimers, "what this app is and isn't" descriptions, terms of service, and similar surfaces — this document is the source for what's honest. Specifically:

- Any limitation tagged "Inherent" or "Accepted as inherent" should likely be named in user-facing communication.
- Any limitation tagged "Open" with high severity should be addressed or named before user-facing release.
- Limitations resolved before users arrive don't need to be named, but the resolution should be documented.

The planning doc principle "transparency about the AI" requires knowing what to be transparent about. This document is the working register for that.

---

## What this document is not

- Not a bug tracker. Bugs go elsewhere (issues, code comments, etc.). This document is for limitations and design constraints.
- Not exhaustive. Add as needed; don't try to populate completely up front.
- Not a roadmap. The v2 roadmap document (`docs/v2-roadmap.md`) covers planned future capabilities. This document covers current limits.

---

*Last updated: initial version. Add entries as encountered.*
