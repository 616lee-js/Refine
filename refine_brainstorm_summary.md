# Refine — Mental Health App

## Brainstorm Summary

The reasoning behind the design — why this product is shaped this way.

*Companion to the v1 Planning Document.*

---

## Purpose of this document

This document captures the reasoning behind the design decisions in the v1 planning document. It is the brainstorm record — what was considered, why specific choices were made, what was rejected and why, and the gaps and concerns identified during planning.

Use this document when:

- You are revisiting a decision and want to remember why it was made the way it was.
- You are sharing the project with a collaborator (a clinician, a privacy reviewer, a contractor) who needs to understand the design philosophy, not just the spec.
- You are evaluating whether a new constraint or piece of feedback should change a foundational decision — the reasoning here helps you weigh it.
- You are losing the thread on the project's identity and want to reconnect with the why.

The planning document tells someone what to build. This document tells them why this is the right thing to build.

---

## Vision

A reflective journaling tool with reflection and self-improvement practices supplemented by AI. Users journal — by voice or text — about what they are working through, and the tool helps them articulate their experience, build a sustainable reflective practice, and (in later versions) recognize patterns across time.

Built on the belief that resources to support improved mental health management and growth toward self-directed goals should be accessible to all, in service of building a world with empathy and care.

The tool's distinctive value is offering a complementary form of reflective work that operates with immediacy and self-direction the professional pathway structurally cannot — available in the moments when reflection is live, audience-free, and self-paced. This is true for users who have access to professional care and for those who don't. Grounded in lived experience of what existing mental health systems get wrong.

### Why this framing matters

Two structural properties define what the app uniquely offers:

**Immediacy.** A therapist exists on appointment cadence. By the time the user arrives at an appointment, the emotional state has decayed into recall. The app, by being available in the moment, captures the experience at its actual pitch rather than the user's later reconstruction.

**Audience-free self-direction.** In a therapeutic relationship, the user is partly performing for the therapist — even with a great therapist, awareness of audience shapes what gets shared. Self-directed reflection removes the audience problem. There is no relationship to manage, no fit to evaluate, no judgment to navigate. That changes what becomes accessible.

Together, these properties describe a kind of reflective work that cannot be done in the professional pathway. The app is not therapy lite. It is a different category of work, complementary to professional care rather than substitutive.

---

## Theory of change

A specific answer to: what is different about a user who has used this app for six months?

Three reinforcing mechanisms:

**Building a sustainable reflective practice.** The act of regular reflection has compounding benefit, like meditation or exercise. The app makes this practice easier and lower-friction than journaling alone.

**Self-knowledge through articulation.** Users learn about themselves by speaking and writing themselves into clarity. Claude's role is mostly to be a careful listener whose questions help the user articulate what they didn't know they knew.

**Longitudinal pattern recognition.** Visibility into patterns across time — themes, language shifts, recurring concerns — that no human consciousness can manage about itself. This is the distinctive layer the app uniquely adds, available from v1.5 onward.

When the app is working, one or more of these is happening for the user. When it is not working, the design has failed at one or more of these. This is the success metric — not engagement, not retention.

Other plausible theories of change (co-regulation and emotional processing; values-aligned change through clarification) show up as supporting modes within the primary frame, not as the primary mechanism.

---

## Product identity

### Audience

Adults seeking self-guided growth, in or out of therapy. The app does not require professional care to be useful, and does not become irrelevant when a user has it. Particular attention to users for whom the professional pathway has failed, is inaccessible, or is being supplemented.

This audience choice has implications. The "not in therapy" population is the highest-stakes group ethically — people in therapy have a clinician backstopping them; these users won't. That means the safety architecture has to be exceptionally well-designed.

### Positioning: wellness, evidence-informed, explicitly non-clinical

Refine is positioned as wellness, not therapy. This positioning lets the app cite research and use techniques derived from evidence-based modalities without claiming clinical efficacy. Practically, this means language like "inspired by approaches used in CBT" rather than "delivers CBT." It also means a clinical advisor reviews system prompts and technique selection before public launch.

The "explicitly non-clinical" qualifier matters. Without it, "evidence-informed" can drift into therapy-shaped marketing. The explicit non-clinical framing keeps the line clear — for the product owner, for users, and for any future regulator.

### Claude's role: mirror first, guide when warranted

Three roles were considered: mirror (reflects, asks questions, helps user reach own insights), guide (offers frameworks, gentle interpretations, suggestions), and coach (more directive, sets goals, holds accountability).

The chosen role is mirror-and-guide — primarily reflective, with substantive guidance when the moment calls for it. This is harder than pure mirror (Claude has to know when to step in) and harder than pure guide (Claude has to resist the trained urge to be helpful by giving advice). The art is knowing when to do which.

### Cadence: user-driven, daily encouraged, no streaks or guilt

The decision was deliberate. Streaks for journaling apps create exactly the cycle the app is trying to avoid — guilt, avoidance, abandonment, shame. The research on dark patterns in mental health apps is increasingly damning on this point. Gentle reminders the user controls fully, with invitational language and zero negative reinforcement, is the floor.

---

## Scope of issues

Governing principle: the app's scope is what users can reasonably navigate themselves. It serves as a complementary reflective surface — never as a substitute, never as a gatekeeper.

The scope was defined before the therapeutic framework was chosen, deliberately. Most projects pick a framework first ("this is a CBT app") and let it dictate scope. The inverse ordering — scope first, framework second — produces a more coherent product because the framework follows from what users actually need rather than the reverse.

### Core scope — strong fit

Stress, self-understanding, life transitions, work and career concerns, identity exploration, motivation and habits, decision-making and ambivalence.

These are reflective, growth-oriented, low-clinical-risk areas where journaling has real evidence and the app's design genuinely fits. They are also the natural home territory for Motivational Interviewing — the conversational stance the app adopts.

### Conditional scope — supported with care

Anxiety (subclinical), low mood (subclinical), self-esteem and self-criticism, relationships (user's own role and patterns only), grief, parenting, family-of-origin patterns, loneliness (framed as self-exploration, not companionship).

Real fit, but the system prompt and safety architecture have to be carefully designed to recognize when something has crossed into clinical territory. Each carries specific risks: relationships invite sycophancy and one-sided narratives; loneliness invites dependency on the AI as substitute connection; family-of-origin work touches trauma; subclinical anxiety and depression can mask conditions that warrant professional support.

### Out of scope

Trauma processing, addiction treatment, severe mental illness, acute crisis.

These require professional intervention. The app routes users toward appropriate care without abandoning them. Importantly, "out of scope" does not mean "the app refuses to engage." It means the app does not attempt to do clinical work in these areas, but holds space and points outward when these come up.

---

## Safety architecture

The safety architecture is the most important design work in the project, and the place where lived experience most directly informed the design.

### The defining commitment

Continued support is never contingent on the user accepting professional referrals. The app stays present, names its limits honestly, and offers — not gates — appropriate resources.

This commitment came from a specific insight: many mental health apps fail users at the moment of greatest need by aggressively pivoting to crisis resources and effectively rejecting the user. A user who has tried professional pathways and found them inadequate, or who feels unable to disclose to professionals, opens an app like this seeking any lifeline. An app that immediately says "this isn't for that, please call 988" rejects the user just like every other system has. The user closes the app and is more alone than before.

The design move is to stay present while being honest about limits. Refine does not pretend not to notice serious distress. It also does not abandon users who are not ready or able to seek other care. Resources are offered, not gated.

### The four tiers

#### Tier 0 — baseline presence

Crisis resources always available, one tap away, never disruptive. Onboarding establishes what the app is and isn't. Every user knows from the start what is available if they need it.

#### Tier 1 — elevated distress

Hard emotions, dark themes, significant struggle. Claude shifts tone — more careful, slower, less fix-oriented. Stays fully present. Does not pivot to resources. May naturally weave in something like "is there anyone in your life who knows you're carrying this" but does not push.

#### Tier 2 — concerning indicators

Passive ideation, sustained hopelessness, severe darkness, references to self-harm without active plan. Claude names what it is seeing, gently and honestly. Acknowledges that what the user is describing is the kind of thing professional support is well-suited for, and offers specific resources without making continued conversation contingent on accepting them. Stays with the user if they want to keep talking.

#### Tier 3 — acute risk

Active plan, imminent intent, ongoing severe abuse the user is enduring. Claude is honest that this is bigger than what the app is built to fully hold, points clearly to crisis resources, and does not continue as a normal session. The app remains a place the user can return to — Claude is not abandoning them, but being honest about what they need beyond what the app can provide.

### Why four tiers and not three

An earlier version of this design had three tiers. The four-tier version separates "elevated distress" (Tier 1) from "concerning indicators" (Tier 2) because the response is meaningfully different. At Tier 1, surfacing resources can feel like rejection — the user is having a hard moment, not a crisis. At Tier 2, not surfacing resources can feel like complicity in avoidance. The tier separation lets the app respond appropriately to each.

---

## Evidence base

Motivational Interviewing as primary conversational stance, with techniques drawn from CBT and ACT applied contextually. Framed as conversational tools in a non-clinical setting, not as treatment.

### Why MI as primary

Three reasons reinforce each other:

- It matches the conversational stance already chosen (mirror-and-guide). MI was designed for partnership, acceptance, evocation, and compassion — exactly the stance the app aims for.
- It matches the audience (self-driven change, not in therapy). MI was developed for people working through ambivalence about change, which is exactly the territory of self-guided growth.
- It gives the cleanest evaluation framework. MI has well-validated process measures (the MITI scale) that a clinician could use to evaluate whether Claude is actually doing MI in sessions. That is a real, defensible quality bar.

### Why CBT and ACT as supporting techniques

CBT offers techniques for cognitive reframing — useful when a thought distortion is clearly present and the user is ready to examine it. ACT offers values clarification and defusion — useful when the user is stuck on a thought or working through what they actually want.

Critically, these are used as conversational tools, not as delivered modalities. The app does not "deliver CBT" or "deliver ACT." It draws on these traditions when relevant. This distinction preserves the wellness positioning and keeps the clinical line clear.

### Why not other frameworks

Eclectic ("Claude draws from anything that fits") was rejected because without a coherent stance, Claude can feel inconsistent — gentle one moment, directive the next. It also makes the product harder to describe and evaluate. Eclectic tends to default to whatever is most common in training data, which is heavily CBT-flavored — so eclectic ends up being implicit CBT-with-extra-steps rather than true integration.

Modality-agnostic ("evidence-informed means generally accepted practices") was rejected because "evidence-informed" then stops doing real work in marketing — it becomes a vibe rather than a claim.

IFS (Internal Family Systems) was considered but is more specialized and harder to use lightly without misrepresenting it.

---

## Data architecture — the filing-cabinet model

How does session data become longitudinal insight? This is one of the most consequential architectural decisions in the project.

### The two main approaches

**Read fresh each time.** When the user asks for insights, the system grabs recent entries and Claude reads through them right then. Simple, but it has limits: Claude can only hold so much in mind at once, so this doesn't scale past a few weeks of entries; and answers vary because Claude is starting from scratch each time.

**Process entries as they happen, then build insights on top.** When a user finishes a session, the system does lightweight analysis in the background — tagging the entry with structured information. That structured information is stored alongside the raw entry. Insights later can look at the structured information across hundreds of entries quickly, rather than re-reading hundreds of raw entries.

The chosen approach is the second, in a layered form.

### The five cabinets

**Cabinet 1 — raw entries.** The actual words the user wrote or spoke. Untouched, encrypted, kept as the source of truth. Multiple parallel streams supported: journal entries, structured check-in data, future assessment scores. Each is its own kind of source-of-truth data.

**Cabinet 2 — structured summaries.** After each session, Claude writes a brief narrative summary in something like a clinical-notes format — what was shared, what was prominent, what threads might be present, with notable verbatim quotes preserved. This enables longitudinal querying without re-reading every entry.

**Cabinet 3 — semantic fingerprints.** Each entry becomes a vector embedding for finding non-obvious connections. Two entries with similar fingerprints are similar in meaning, even if they don't share words. Built in v1.5, not v1.

**Cabinet 4 — assessment data.** Optional structured scores over time (PHQ-9, GAD-7, WHO-5, life satisfaction). Used as input to Claude's calibration, not as labels presented to the user. Built in v1.5 or v2.

**Cabinet 5 — synthesis layer.** Claude as the librarian who pulls from all four cabinets and writes coherent, human-readable insight grounded in specific entries the user can revisit. Built in v1.5.

### Two important properties

**Re-processability.** Cabinet 2 content can be regenerated from Cabinet 1 entries when the schema or prompt evolves. No early decision is permanent. This matters because understanding of what to track will evolve.

**Grounded insights.** Any insight the synthesis layer surfaces should be traceable to specific entries. The user can verify or push back. This is both an accuracy mechanism and a transparency mechanism.

### Why the schema specifics are deferred

Specific tag dimensions, exact summary format, and what makes a quote notable are deferred to v1.5 design-against-real-data. The schema should follow the data, not precede it. Defining specifics in the abstract is the kind of decision that calcifies wrong if made too early. Better to capture rich raw data in v1, look at it carefully, and design against real examples.

---

## Context architecture — the four layers

Different kinds of context have different origins, lifecycles, and trust levels. Treating them as one undifferentiated blob (one giant system prompt) means you can't update one without touching the others, can't audit where guidance came from, and can't easily verify the system is following the rules you wrote.

### The four layers

**Layer 1 — foundation model.** The base Claude model. Choice of model determines response quality, latency, and cost. Updates rarely.

**Layer 2 — application character and behavior.** The system prompt defining what the app is, the safety tiers, the stance, the principles. Same for every user, every session. Updates rarely and with care, with clinician review. The app's identity.

**Layer 3 — clinically-grounded reference.** Reference material drawn from peer-reviewed research, MI guidelines, CBT/ACT protocols, evidence-based crisis response, resource lists. Pulled in selectively based on context, not given to Claude wholesale every request. Updates as research evolves and clinician advises.

**Layer 4 — user-specific context.** Persistent memory, session-derived insights, assessment history, recent conversation. Editable by the user. Volatile, session-by-session.

### Why the layers matter beyond elegance

Several practical reasons:

- **Auditability.** When something goes wrong, you can trace which layer's guidance failed.
- **Update without disturbance.** When the resource list needs updating, Layer 3 changes without touching Layer 2.
- **External review.** A clinician reviews Layer 2 and Layer 3. A privacy reviewer reviews Layer 4. Each reviewer has clear scope.
- **User trust and transparency.** Users can see Layer 2 (the app's character) and a description of Layer 3 (the kinds of clinical references). They see all of Layer 4 and can edit it. Meaningful transparency without overwhelming the user.
- **Evaluation.** Each layer becomes a specific target for evaluation rather than evaluating "the system" as a monolith.

---

## Insight scope — what the app is allowed to surface

A spectrum of what kinds of insights are appropriate, with concrete decisions at each level.

### The spectrum

**Descriptive — naming what's there.** "Over the past three months, work has been the most frequent topic, appearing in 60% of entries." Lowest risk, lowest depth. Useful as scaffolding.

**Connective — surfacing relationships between things.** "On days when you've journaled about sleep difficulties, you've also tended to mention work pressure." Powerful because it surfaces things visible across entries but not within any single one. Most of the value lives here.

**Interpretive — proposing what it might mean.** "There's a pattern in how you describe your sister versus other relationships — the language is more guarded." Where the value is highest and the risk is highest. A correct interpretation can crack something open. An incorrect one is more harmful than no interpretation, because the user may believe it.

**Suggestive — proposing what to do with it.** "Given the pattern, you might find values clarification work helpful." This is therapy-shaped behavior. Even when the suggestion is good, it positions the app as advisor in a way that conflicts with the mirror-and-guide stance.

**Diagnostic-adjacent — labeling.** "Your check-in scores combined with the rumination patterns suggest a sustained low-mood pattern consistent with dysthymia." Clinical territory.

### The lines

Descriptive and connective: surfaced freely when the user asks or when a longitudinal threshold is hit.

Interpretive: offered tentatively, always framed as possibilities rather than claims, ideally as questions the user can sit with rather than statements about who they are. Best when invited rather than pushed.

Suggestive: replaced with reflective questions. Instead of "you should try X," the app asks "what would you want to do with this if you sat with it for a while?"

Diagnostic-adjacent: hard out. Even if the data clearly suggests something clinical, the app's job is to surface enough that the user can recognize it themselves and pursue appropriate support, not to label it.

### The five commitments that resulted

1. Descriptive and connective freely; interpretive carefully and hedged; no suggestive or diagnostic-adjacent unsolicited.
2. When the user asks about possible clinical patterns, the app describes observed features and recommends professional consultation, but does not name conditions even tentatively. The distinction matters: the app can describe the experience ("sustained worry, physical tension, sleep disruption") and recommend consultation, but does not say "this sounds like generalized anxiety disorder."
3. Diagnostic context (formal or self-reported) is accepted as user-provided context, used to inform engagement, but not adopted as the interpretive frame for everything. The risk to avoid is the app reinforcing a diagnostic frame in a way that becomes self-fulfilling.
4. Substantive contextual disclaimers accompany any diagnostic-adjacent content, not boilerplate. "This app is not a substitute for professional mental health care" is true but performs ass-covering rather than informing. Better: "What I'm noting here is based on the patterns in what you've shared with me. I'm not a clinician and can't tell you whether this means anything clinically. If this is worth understanding more deeply, that's a conversation worth having with someone qualified to help you make sense of it."
5. Voice and text are distinct input modalities. Both preserved. Modality-specific signal captured. Voice carries higher privacy considerations than text.

---

## Evaluation framework

Without an evaluation framework, the app would be shipping insights based on whether they feel right in the moment — the metric that produces horoscopes. Four modes, layered:

**Personal calibration.** The product owner uses the app for months and develops a felt sense of when its insights are accurate, when they're shallow, when they're flatly wrong. Necessary but insufficient.

**Persona-based testing.** Synthetic users with deliberately constructed inner lives, including hidden patterns. Tests whether the system can find what's actually there.

**Negative testing.** Personas with no coherent pattern, validating that the system won't manufacture insights anyway. The most important and most-skipped mode. A system that finds patterns when they're there but also when they aren't is worse than no longitudinal feature at all.

**Clinical review.** A licensed clinician reads sample outputs and evaluates them on accuracy, appropriateness, harm, and tone — using a structured rubric, not gut feel.

### Why negative testing matters most

It is tempting to focus on "can the system find the pattern I hid" because that is the gratifying test. But a system that finds patterns whether they exist or not is producing horoscopes whether or not it sometimes happens to be right. You would rather have a system that reliably says "nothing strong has emerged in this window" when nothing has, even if it sometimes misses real patterns, than one that confidently surfaces patterns whether they exist or not. The first failure mode is honest; the second is a horoscope.

---

## User autonomy and data

User control over their own data is a first-order principle, not a setting. This follows directly from the app's structural identity (immediate, self-directed, audience-free reflection).

### What this means

- Users can view, edit, redact, and fully delete any stored content — raw entries, summaries, memory, derived insights.
- Deletion means actual deletion, including from any derived structures (tags, embeddings, summaries) that referenced the deleted material.
- System prompt visible (read-only); user memory editable; insight layer visible and editable.
- User corrections to derived content are authoritative. The system does not argue with them. If the user says "this isn't accurate," it isn't.
- Encrypted cloud storage when deployed, treated with PHI-grade rigor even though wellness positioning doesn't legally require it.
- Field-level encryption on journal content; voice data carries higher privacy considerations than text.

### Why this is first-order

Two specific reasons:

The user may share something they later regret. This is a real consequence of the immediacy advantage. If the app captures the user at peak emotional intensity, the user has the right to walk that back when they have more distance — including by removing it from the system entirely.

The stored interpretations may not reflect the user's actual experience. The app's summaries and derived insights can be wrong. The user has the right to correct or remove anything that misrepresents them.

### Product improvement using user data

When (and if) user data is ever used for product improvement:

- Default: data is not used. Opt-in only, never opt-out.
- Granular consent for different uses.
- Genuine deidentification beyond just removing names — handled with privacy expertise.
- Reversibility where technically possible; honest about the limits.
- Use is reviewed for whether it actually serves users (improving safety architecture) versus just serving the app (engagement optimization).

This is a v2 concern. v1 and v1.5 use only the product owner's own data plus synthetic personas.

---

## Anti-dependency design

Refusing to be a companion is directional, not architectural. Anti-dependency design is what Refine actively does — not just what it refuses to do — to discourage unhealthy reliance.

### The categories of anti-dependency design

**Friction at the right moments.** Small frictions where they protect the user — not optimizing for frictionlessness in every interaction.

**Pointing outward, not just resourcing in crisis.** The app naturally references human connection, suggests bringing things to people in the user's life, asks "is there someone you'd want to talk with about this?" Not formulaic — woven into Claude's conversational stance.

**Naming when reflection becomes avoidance.** When a user has been writing about something for weeks without acting on it, the app gently surfaces this. Not as judgment — as reflection. v1.5+ feature, requiring longitudinal data.

**Celebrating exit and outside support.** When a user mentions starting therapy, joining a group, having a meaningful conversation — the app responds with genuine warmth and reduces its own footprint. The opposite of how engagement-optimized products behave.

**No engagement mechanics ever.** No streaks, badges, levels, points, notifications-that-create-guilt. Architectural floor.

### Anti-dependency does not mean anti-meaning

A late refinement: Refine should not be silent about whether it is working for users. The mission is helping people grow. If users do not experience that growth, or do not recognize it when it is happening, they lose the relationship to their own progress and the app loses its meaning to them.

The line: value is communicated in the language of the user's own experience, not in the language of metrics about the user. Surfacing "here's what you've been working on, and here's how the language has shifted" is different from "you're 60% more reflective than last month." The first is the user reflected. The second is a number that judges them.

Where this shows up:

- In longitudinal feature, framing patterns as "what's emerging in your own reflection" rather than "data on you."
- In export reports — these are themselves a form of communicating value.
- In light real-time calibration — "did that land?" — giving the user a moment to register what just happened.
- In periodic optional reflection on the practice itself — "what's this been giving you?" Letting the user evaluate the app and themselves.

---

## Sessions, onboarding, and the blank-page problem

### Why session types matter

A scheduled session (one set up in advance) is a different beast than an as-needed session (the user opens the app because something just happened). The scheduled session usually doesn't have a specific urgent thing driving it; it benefits from a slightly more structured opening. The as-needed session already has its own driving content; the structured check-in is potentially in the way.

Session types matched to context — scheduled, as-needed, guided — let the opening be appropriate to the moment. The user can shift between types intentionally.

### Input quality

Bounded length, focused prompts, structural guidance — these affect insight quality downstream, independent of cost. A user who rambles into a voice session for 45 minutes while distracted produces a different artifact than a user who takes a focused 8-minute reflection. The longer one might feel more substantive but contain less signal. Garbage in, garbage out applies even to reflective journaling.

Worth being honest: shaped input is also more cost-efficient and supports more users at lower price points. These reinforce each other. Input quality and unit economics are not in tension; they align.

### Progressive onboarding

A choice between two failure modes:

Front-loaded onboarding optimizes for getting it right the first time. Captures lots of user context up front but exhausts users before they've gotten any value. The population most likely to benefit from this app — including users in moments of need — often won't survive a 20-minute setup.

Progressive onboarding optimizes for recovering as we go. Minimal first touch (under 5 minutes), with the app naturally gathering more context across the first several sessions through real conversation rather than profile forms. This fits with the app's structural identity — low-friction recovery is one of its advantages over the professional pathway.

The chosen approach is progressive. The app gets to know the user through use. Honest expectation-setting at the start tells the user this is how it works.

### The blank-page problem

First 5–10 sessions are uniquely fragile. Claude has no memory, no patterns, weak commitment. Most journaling apps lose 60-80% of users in this window because the early experience is hollow.

The chosen design move: three doors at session start (open space, a single contextual starting question, or a guided structure), with the open space as default for users who don't choose. This way, users who hate prompts get openness; users who freeze in openness get a starting point; users who want structure can have it. Nobody is forced into a mode.

Specifically for early sessions, slightly more scaffolding. As history accumulates, the app naturally becomes quieter and lets the user lead more.

---

## Export feature — bridge to other support

A user with consistent journaling history can generate a structured summary report to share with a therapist, doctor, partner, sponsor, or other supporter. Reinforces the app's role as complement to — not replacement for — other support systems, and gives users a clean exit path when they graduate to professional care.

### Why this matters

Several things the export does at once:

- Acknowledges that what the user works through here is meaningful and worth bringing to others.
- Gives a therapist or supporter context they couldn't otherwise have — especially valuable for professionals who only meet with the user every few weeks.
- Anti-dependency mechanism — the app actively supports the user moving outward.
- A graduation path — Refine is comfortable being a station, not a destination.

### Design properties

- User-curated: Claude generates a draft, user edits before export.
- Multiple templates available, tailored to recipient (therapist, doctor, personal supporter).
- Default delivery: user-controlled — download a PDF or copy text, share through their own channels. The app is not a delivery mechanism in v1.
- In-app secure delivery is a v2-or-later consideration.
- Designed so journaling stays free and honest — no in-the-moment indicator that any entry counts toward a future report. The report is a synthesis on top of freely-written data.

### Why deferred to v1.5

Export reports require accumulated data and the synthesis layer to produce coherent summaries. v1 accumulates the data; v1.5 builds the export.

---

## Build sequencing — why three phases

The decision to split the build into v1, v1.5, and v2 was not arbitrary. Each phase has a specific goal and a specific gate.

### v1 — foundation

Purpose: validate the core experience and accumulate real journaling data. The product owner uses the app daily for weeks. Nothing is shipped to other users.

What this protects against: shipping a longitudinal feature that has been built against synthetic data (which is over-coherent and produces falsely good results) rather than against real, messy, low-signal-amid-noise journaling. Until you have weeks of your own real data plus persona data, designing the longitudinal feature is premature.

### v1.5 — longitudinal

Purpose: build the pattern reflection feature against real plus persona data. Test it for both signal extraction and false-positive resistance.

What this protects against: a longitudinal feature that produces horoscopes — patterns that look meaningful but aren't. Negative testing throughout v1.5 development.

### v2 — trusted tester release

Purpose: bring the app to a state where other humans can use it. This requires substantial work that does not happen in v1 or v1.5 — clinical review, privacy and legal review, cloud deployment, consent flows.

What this protects against: shipping a mental health product to real users without the clinical and legal review the work deserves.

### Why the gate matters

The hard gate before v2 is non-movable. This protects users from being subjects of an under-reviewed product, and protects the project from causing harm that would be both ethically wrong and operationally devastating.

---

## Sustainability and unit economics

Not a v1 or v2 concern, but the shape of the eventual model is worth holding in mind so design choices don't preclude it.

### The cost shape

Variable cost per active user is real and recurring (Claude API + transcription). Subscription, not one-time fees. A typical moderate user costs $1-2/month in variable costs; a heavy user can approach $3-5/month. Plus infrastructure overhead and payment processing.

### Provisional pricing

$8-12/month is the realistic range where unit economics breathe. $5/month is workable but tight, with most users subsidizing heavy users.

### Free tier and access

A free tier should exist and be genuinely useful but bounded — maybe text-only, basic monthly summaries, no voice, no longitudinal insights, no exports. Enough to support someone who genuinely can't pay; not the full experience.

A scholarship or by-request access path is worth implementing as an explicit mission-aligned feature. Unusual in consumer apps, mission-aligned for this one. The users who most need a lower-threshold option are also the least able to pay.

### Tier differentiation

Tiers should differentiate on volume (sessions, longitudinal access, exports) rather than on input freedom. Paying more should not get you a worse-quality experience by removing structural constraints that improve insight quality.

---

## What's distinctive about this approach

Compared to existing products in the mental health and journaling space:

- **Constraints-first design.** Audience, ethics, and scope determined features, not the reverse.
- **Refusal of engagement mechanics, gamification, and companionship framing.** Costly choices made deliberately.
- **Transparency commitments rare in the category.** Visible system prompt, editable user memory, distinct insight layer the user can correct.
- **Four-tier safety architecture with continued presence.** Based on lived experience of how aggressive escalation harms users.
- **Scope-before-framework sequencing.** Most projects do the inverse.
- **Recognition that for many users, the professional pathway has failed or is inaccessible.** Designed to serve those users with dignity, not to compete with the pathway.
- **Export feature as a graduation path.** The app is comfortable being a station, not a destination.
- **Multi-horizon longitudinal thinking.** Patterns surfaced at the cadence they're actually readable, not on demand.
- **Structural value the professional pathway can't offer:** immediacy and audience-free self-direction. The app is complementary, not substitutive — true regardless of user access to professional care.
- **User autonomy over data treated as first-order principle, not a setting.**
- **Anti-dependency design that does not become anti-meaning.** Value communicated in the language of the user's experience, not in metrics.

---

## Gaps and concerns held for ongoing work

These were named during planning as real considerations that are not yet fully designed. Some are deferred to v1 build (designed against real use); others to v1.5 (designed against real data); others are ongoing concerns rather than discrete design tasks.

### Theory of subtle harm

Crisis is handled. Slow harm is not yet designed for. An app like this can:

- Subtly entrench unhelpful narratives ("Claude agreed I'm a victim of my mother").
- Become an avoidance mechanism ("I'd rather journal than have the actual conversation").
- Produce false patterns the user comes to believe about themselves.

The four-tier safety architecture handles acute harm; it does not yet handle subtle, slow harm. Ongoing concern.

### Conversational continuity specifics

User memory needs to support threads, not just facts. If a user mentions a job interview Monday, does Claude remember to ask Tuesday how it went? This is partly architectural (Layer 4) and partly about how memory is updated and surfaced. v1 build phase work.

### Cultural and demographic assumptions

Self-guided growth, MI, journaling, structured check-ins all carry cultural assumptions (Western, individualist, language-fluent, comfortable with introspection, reasonably literate, with the time and emotional bandwidth to sit with feelings). Worth being honest about who the app is and isn't for, rather than imagining it's universal.

### The past-self check

The product is being designed in part around retrospective wisdom — what the product owner now knows the past version of themselves needed. People in the depths often resist the very things that would help. Worth periodically asking: would past-me have actually engaged with this, or is this what I wish past-me had engaged with? Ongoing reflection rather than a one-time decision.

### Tone, voice, and personality of Claude

The system prompt's character work. Better designed against a v1 prototype than in the abstract. v1 build phase work.

### Resource list curation

Warmlines, sliding-scale options, text-based services — not just hotlines. v1 starts with a basic curated list; full curation is part of the v2 clinical review.

### Report templates and contents

What goes in the export by default, what the user can add, what redaction controls exist, whether secure delivery is pursued. v1.5 design work.

---

## Hard gates before public launch

Items that must be complete before any user other than the product owner uses the app. Non-movable.

- Licensed clinician reviews safety architecture, system prompts (Layer 2 in full), Layer 3 clinical reference fragments, tier classification logic, and curated resource list.
- Privacy and legal review of terms of service, privacy policy, onboarding disclosures, data retention and deletion policies, and any product-improvement data pipeline.
- Cloud deployment with proper encryption at rest and in transit, automated backups with deletion that propagates, and incident response readiness.
- Tester consent flows with written acknowledgment of prototype status, what data is held, and what the user is participating in.
- Negative testing run on the full longitudinal feature against personas with no coherent pattern, validating the system does not manufacture insights.
- Clinical review of representative outputs (longitudinal reflections, export reports) against a structured rubric for accuracy, appropriateness, harm, and tone.

This gate exists because the product is asking users to trust it with their inner lives. None of these items is optional. They are also worth starting early — finding a clinician advisor with digital health experience takes time, and having them lined up means the gate isn't blocked on recruitment.

---

*— End of brainstorm summary —*
