# Refine — Build Notes

Design decisions and forward-looking requirements that don't fit in the planning doc or v2-roadmap. Read this before starting each phase.

---

## Phase 6 — Background Summarization (Cabinet 2)

**Requirement:** The Cabinet 2 narrative summary must capture tonal and emotional context, not just topics.

The summary exists so that future sessions can open with appropriate awareness of where the user was last time — not just what they talked about, but how they were doing. A topic-only summary ("user discussed work stress, relationship difficulty") misses the thing that matters: was the user holding it together or barely keeping it together? Were things shifting? What was the emotional register of the session?

When designing the summarization prompt in Phase 6, the summary should answer:
- What was the user carrying? (topics + emotional weight)
- What was the tone and texture of how they were? (not just what was discussed)
- Was there any movement or shift during the session?
- Anything the next session should be gently aware of?

This is what enables the model to open a new session with calibrated presence rather than a blank-slate greeting that ignores history.

---

*Add notes here as they come up during build — especially requirements identified in one phase that belong to a later phase.*
