# docs/

Index of project documentation. Source of truth for what to build is `refine_v1_planning.md`. All other documents are supporting.

---

## Planning and design

**[refine_v1_planning.md](refine_v1_planning.md)**
Full v1 product and technical specification. The authoritative build reference. Phase sequence, feature scope, v1 non-goals, and architectural decisions all live here.

**[refine_brainstorm_summary.md](refine_brainstorm_summary.md)**
Companion to the planning doc. Captures the reasoning and tradeoffs behind design decisions — the "why" behind what the planning doc specifies.

## Prompt management

**[prompt-changelog.md](prompt-changelog.md)**
Versioned record of changes to Layer 2 (system prompt) and Layer 3 (reference fragments). One entry per meaningful edit. Update when any prompt file changes.

**[build-notes.md](build-notes.md)**
Forward-looking requirements identified during the build that belong to a later phase. Read before starting each new phase to catch deferred requirements.

## Testing and evaluation

**[refine_test_prompts.md](refine_test_prompts.md)**
Living library of test cases for evaluating Claude's behavior — single-turn cases (TC-###), persona behavioral arcs (ARC-###), and designed-against edge cases (EDGE-###). Run before committing any system prompt or Layer 3 protocol change.

**[refine_testing_cadence.md](refine_testing_cadence.md)**
Testing approach by phase: what to test, when, and how. Includes structured review templates and per-session quick capture format. Operational reference — consult when testing decisions arise; do not modify unless explicitly asked.

**[refine_test_personas.md](refine_test_personas.md)**
Synthetic test personas for longitudinal feature evaluation. Dormant until after Phase 7. Do not reference during current build phases.

**[refine_known_limitations.md](refine_known_limitations.md)**
Running register of design constraints, architectural compromises, and known gaps (LIM-### tags). Propose new entries; don't add unilaterally.

## Roadmap

**[v2-roadmap.md](v2-roadmap.md)**
Capabilities deferred to v2 — multi-user auth, admin functionality, in-app metrics, export, clinical review gate. Not a build priority until v2 starts.
