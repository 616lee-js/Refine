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

Voice session audio is saved to `./audio/[sessionId]/[uuid].webm` in plain binary — no AES-GCM encryption. The `audio/` directory is `.gitignore`d. Contrast with text entries, which are AES-256-GCM encrypted at rest. On a solo local machine this is low risk; before any shared-server or cloud deployment, audio must be encrypted at the application layer (or via filesystem encryption).

**Future:** Encrypt audio files at rest using the same key derivation as entry content, or use filesystem-level encryption for the audio directory.

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

#### LIM-006 — Local-only deployment through v1 and v1.5

**Severity:** Inherent to current build approach
**Status:** Accepted; resolved at v2

The app runs locally on the developer's machine through v1 and v1.5. No remote access. No backups beyond local. This is by design — it keeps costs near zero and avoids cloud commitments while the product is being validated. The v2 gate addresses cloud deployment formally.

---

### Scope limitations (v1)

These are deliberate v1 non-goals from the planning doc, listed here for cross-reference.

- No longitudinal pattern surfacing in v1 (v1.5)
- No export reports in v1 (v1.5)
- No validated assessments in v1 (v1.5+)
- No personality assessment in v1 (v1.5+ if at all)
- No multi-user support in v1 (v2)
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
