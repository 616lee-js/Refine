# Prompt for Claude Code

Unzip into `docs/design/component-refresh/`, then paste everything below the line.

---

Read `docs/design/component-refresh/README.md` first. It's the spec for a component refresh plus a new user preference. Reference values live in `reference/theme.jsx`, `reference/theme-ext.jsx` and `reference/atoms.jsx` — take hex values, sizes and spacing from those, don't approximate. For globals.css, paste `reference/palettes.css`. It is generated and complete, so don't retype values from the README.

Do it in this order, one commit each:

1. `globals.css`: Dawn/Dusk/Slate palette blocks, the new tokens (`--rf-error`, `--rf-error-soft`, `--rf-scrim`, per-palette `--rf-sheet-shadow` and `--rf-grain-image`), and `--color-error` pointed at `--rf-error`. Update `page-bg.tsx` and the guidance sidebar scrim to use them. Nothing should look different under Dawn.
2. Replace the hardcoded `rgba(163, 58, 37, 0.08)` everywhere with `var(--rf-error-soft)`.
3. Toast, Badge, SectionLabel, and a new `Notice`, as in README §4. Use `Notice` in read-back, the entry-summary stale note, and auth.
4. Rebuild login and signup (README §3). Keep form actions, field names, autocomplete, and COPY objects exactly as they are.
5. Layout (README §5): one 20px gutter everywhere, a full-width left-aligned Reflections row, a 300px left column, and single-column pages at 820px.
6. Dark blocks for all three palettes, including the `system` media-query copies. The admin layout is pinned to Dawn light.
7. The preferences: `palette` + `mode` in the API with cookies, `<html data-palette data-mode>` in the root layout, cookies set on login, `ModeControl` + `PalettePicker`, and the Preferences section in Profile. New accounts, onboarding and the auth pages stay on Dawn light.

Rules:
- Leave every `[COPY]` string alone. The owner is reviewing copy separately.
- Leave the admin tier colours and `--rf-admin*` alone.
