// v3.1 screens — Profile + Preferences, auth, archive/read-back, trash, component sheet.
// Copy is taken from the repo's COPY blocks, with the [COPY] prefix stripped.

function Column({ max = 820, children, style }) {
  return <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', justifyContent: 'center', padding: `24px ${GUTTER}px 0` }}><div style={{ width: '100%', maxWidth: max, paddingBottom: 56, ...style }}>{children}</div></div>;
}

// ── Profile ───────────────────────────────────────────────────────────────
function ScreenProfile({ palette, onPalette, mode, onMode, dark, saved }) {
  return (
    <RfPageBg>
      <RfTopNav active="profile" />
      <Column>
        <RfPageHead eyebrow="Profile" title="What you've told Refine about you" lede="Standing context you can set once and forget. All three are optional and editable whenever you like." />
        <RfSheet style={{ padding: '28px 32px', gap: 22 }}>
          <RfInput id="t" rows={3} label="How would you describe yourself?" note="Patterns you notice in how you think, feel, or move through the world." value="I tend to overthink decisions, and I go quiet when there's too much on." />
          <RfInput id="g" rows={3} label="What do you want from this practice?" note="What you're working toward, or what brought you here." placeholder="e.g. I want to understand my anxiety better and feel less reactive…" />
          <RfInput id="b" rows={2} label="Any background worth knowing?" note="Life context, relevant history, anything that helps Refine understand you." placeholder="Optional — as much or as little as you like." />
        </RfSheet>
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          <RfBtn>Save</RfBtn>
        </div>

        <div style={{ marginTop: 44, paddingTop: 22, borderTop: '1px solid var(--rf-border)' }}>
          <RfEyebrow>Preferences</RfEyebrow>
          <p style={{ margin: '8px 0 16px', maxWidth: 460, fontSize: 13, lineHeight: 1.6, color: 'var(--rf-text-3)' }}>How Refine looks and behaves for you. These save as you change them.</p>
          <RfSheet style={{ padding: '24px 32px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
              <span style={{ fontSize: 14, color: 'var(--rf-text)' }}>Appearance</span>
              <span aria-live="polite" style={{ ...monoCaps(9.5), color: 'var(--rf-text-4)' }}>{saved ? 'Saved' : ''}</span>
            </div>
            <p style={{ margin: '3px 0 12px', fontSize: 11.5, color: 'var(--rf-text-4)' }}>Every palette has a light and a dark version.</p>
            <div><ModeControl value={mode} onChange={onMode} /></div>
            <div style={{ height: 1, background: 'var(--rf-rule)', margin: '24px 0 20px' }}></div>
            <span style={{ fontSize: 14, color: 'var(--rf-text)' }}>Palette</span>
            <p style={{ margin: '3px 0 14px', fontSize: 11.5, color: 'var(--rf-text-4)' }}>The paper everything sits on. Applies wherever you're signed in.</p>
            <PalettePicker value={palette} onChange={onPalette} dark={dark} />
          </RfSheet>
        </div>
      </Column>
    </RfPageBg>
  );
}

// ── Auth ──────────────────────────────────────────────────────────────────
function ScreenAuth({ mode = 'signin', error }) {
  const up = mode === 'signup';
  return (
    <RfPageBg>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ textAlign: 'center', marginBottom: 22 }}><RfWordmark size={28} /></div>
          <RfSheet style={{ padding: '28px 30px 30px' }}>
            <h1 style={{ margin: 0, fontFamily: F.display, fontSize: 25, fontWeight: 380, letterSpacing: '-0.02em', color: 'var(--rf-text)' }}>{up ? 'Create your account' : 'Sign in to continue'}</h1>
            {up && <p style={{ margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.55, color: 'var(--rf-text-3)' }}>Refine is invite-only while it's in testing.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 22 }}>
              {up && <RfInput id="inv" label="Invite code" value="RF-7K2Q-MOSS" mono focus={!!error} />}
              {up && <RfInput id="dn" label="Display name" value="Nadia" />}
              <RfInput id="em" label="Email address" type="email" value={up ? 'nadia@example.com' : ''} focus={!up && !error} />
              <RfInput id="pw" label="Password" type="password" placeholder={up ? '12+ characters' : ''} />
              {error && <RfNotice>{error}</RfNotice>}
              <RfBtn full style={{ marginTop: 4, padding: '11px 18px' }}>{up ? 'Create account' : 'Sign in'}</RfBtn>
            </div>
          </RfSheet>
          <p style={{ margin: '18px 0 0', textAlign: 'center', fontSize: 13, color: 'var(--rf-text-3)' }}>
            {up ? 'Already have an account?' : 'No account?'} <a href="#" style={{ color: 'var(--rf-text-2)', textDecoration: 'underline', textUnderlineOffset: 3 }}>{up ? 'Sign in' : 'Create one'}</a>
          </p>
        </div>
      </div>
    </RfPageBg>
  );
}

// ── Archive: record rail + read-back ─────────────────────────────────────
const RECORDS = [
  { kind: 'Writing', date: 'Wed 24 Sep', detail: 'Work · Rest' },
  { kind: 'Check-in', date: 'Wed 24 Sep', detail: 'Slept 6.5h · Mood 3 · Energy 2 · Walked' },
  { kind: 'Writing', date: 'Tue 23 Sep', detail: 'Work · Relationships', selected: true },
  { kind: 'GAD-7', date: 'Mon 22 Sep', detail: 'Score 8', accent: true },
  { kind: 'Writing', date: 'Sun 21 Sep', status: 'Unfinished' },
  { kind: 'Check-in', date: 'Sun 21 Sep', detail: 'Slept 8h · Mood 4 · Energy 4' },
];

function RecordRailMock() {
  const box = { flex: 1, minWidth: 0, borderRadius: 4, padding: '4px 6px', fontSize: 11, color: 'var(--rf-text-4)', background: 'var(--rf-paper)', boxShadow: 'inset 0 0 0 1px var(--rf-border)' };
  const lab = { ...monoCaps(9), color: 'var(--rf-text-4)' };
  return (
    <aside style={{ width: 300, flexShrink: 0, borderRadius: 4, padding: 12, background: 'var(--rf-surface)', boxShadow: 'inset 0 0 0 1px var(--rf-border)', boxSizing: 'border-box' }}>
      <span style={{ ...monoCaps(9), color: 'var(--rf-text-3)' }}>Search</span>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <span style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 6 }}><span style={lab}>From</span><span style={box}>dd/mm/yyyy</span></span>
        <span style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 6 }}><span style={lab}>To</span><span style={box}>dd/mm/yyyy</span></span>
      </div>
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', borderRadius: 999, padding: '0 3px 0 12px', background: 'var(--rf-paper)', boxShadow: 'inset 0 0 0 1px var(--rf-border)' }}>
        <span style={{ flex: 1, padding: '6px 0', fontSize: 11, color: 'var(--rf-text-4)' }}>Search</span>
        <span style={{ width: 22, height: 22, borderRadius: 99, display: 'grid', placeItems: 'center', background: 'var(--rf-surface)', color: 'var(--rf-text-2)' }}><svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6 H9 M6 3 L9 6 L6 9"></path></svg></span>
      </div>
      <div style={{ display: 'flex', gap: 5, marginTop: 8 }}><RfChip on>All</RfChip><RfChip>Writing</RfChip><RfChip>Check-ins</RfChip><RfChip>Framework</RfChip></div>
      <div style={{ ...monoCaps(9), color: 'var(--rf-text-2)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 5 }}><svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor"><path d="M3 1 L8 5 L3 9 Z"></path></svg>More filters</div>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--rf-border)', ...monoCaps(9), color: 'var(--rf-text-3)' }}>24</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>{RECORDS.map((r, i) => <RfRecordCard key={i} {...r} />)}</div>
    </aside>
  );
}

function ScreenArchive({ toast }) {
  const quote = { margin: 0, fontFamily: F.display, fontSize: 14, lineHeight: 1.55, fontStyle: 'italic', color: 'var(--rf-text-2)', borderLeft: '2px solid var(--rf-border)', paddingLeft: 11 };
  return (
    <RfPageBg>
      <RfTopNav active="reflections" />
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', gap: 28, padding: `20px ${GUTTER}px 0` }}>
        <RecordRailMock />
        <main style={{ flex: 1, minWidth: 0 }}>
          <RfDone>Entry completed</RfDone>
          <div style={{ marginTop: 14 }}>
            <span style={{ display: 'block', fontFamily: F.display, fontSize: 27, fontWeight: 380, letterSpacing: '-0.02em', color: 'var(--rf-text)' }}>The meeting that wasn't</span>
            <span style={{ ...monoCaps(9.5), color: 'var(--rf-text-4)', display: 'block', marginTop: 6 }}>Tue 23 Sep · 9:40pm · Rename</span>
          </div>
          <div style={{ paddingTop: 18, display: 'flex', alignItems: 'center', gap: 12, color: 'var(--rf-text-3)' }}>
            <span style={{ fontSize: 13 }}>What Refine took from this</span><RfBadge variant="active">Your version</RfBadge>
          </div>
          <div style={{ marginTop: 12, borderRadius: 4, padding: '20px 24px', background: 'var(--rf-surface)', boxShadow: 'inset 0 0 0 1px var(--rf-border)' }}>
            <RfNotice tone="warn" style={{ marginBottom: 12, fontSize: 12 }}>This describes an earlier version of the entry. Refine will re-summarise it shortly; your correction is kept either way.</RfNotice>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--rf-text-2)' }}>A cancelled meeting left a gap in the afternoon. Relief first, then guilt about the relief, then a walk that settled both.</p>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}><RfEyebrow size={9}>Categories</RfEyebrow><span style={{ fontSize: 13, color: 'var(--rf-text-2)' }}>Work · Relationships</span></div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}><RfEyebrow size={9}>People</RfEyebrow><span style={{ fontSize: 13, color: 'var(--rf-text-2)' }}>Sam</span></div>
            </div>
            <p style={{ ...quote, marginTop: 14 }}>I didn't know what to do with an hour nobody had asked for.</p>
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--rf-rule)', display: 'flex', gap: 16 }}>
              <span style={{ ...monoCaps(9.5), color: 'var(--rf-text-2)' }}>Edit yours</span>
              <span style={{ ...monoCaps(9.5), color: 'var(--rf-text-3)' }}>See Refine's version</span>
              <span style={{ ...monoCaps(9.5), color: 'var(--rf-text-4)' }}>Discard mine</span>
            </div>
          </div>
          <div style={{ margin: '18px 0 8px' }}><RfEyebrow size={9.5}>Your words</RfEyebrow></div>
          <RfSheet style={{ padding: '36px 40px' }}>
            <p style={{ margin: 0, maxWidth: 760, fontFamily: F.display, fontSize: 18.5, lineHeight: 1.62, letterSpacing: '-0.003em', color: 'var(--rf-text)' }}>The three o'clock got cancelled and I didn't know what to do with an hour nobody had asked for. I felt relieved and then guilty about feeling relieved, which is a very me sequence. I walked to the canal and back instead of answering email. Sam texted while I was out and I didn't reply until I was home, and that was fine.</p>
          </RfSheet>
        </main>
      </div>
      {toast && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 24, display: 'flex', justifyContent: 'center' }}><RfToast>{toast}</RfToast></div>}
    </RfPageBg>
  );
}

// ── Trash ─────────────────────────────────────────────────────────────────
const TRASHED = [
  { p: "Couldn't sleep again. Made a list of the things I'd been putting off and it was shorter than I thought, which helped more than it should have.", d: '14 Sep 2026', left: 2 },
  { p: 'Started this and stopped. The train was too loud to think.', d: '9 Sep 2026', left: 21, confirming: true },
  { p: '', d: '2 Sep 2026', left: 26 },
];

function ScreenTrash() {
  const act = monoCaps(9.5);
  return (
    <RfPageBg>
      <RfTopNav active="mirror" />
      <Column>
        <RfPageHead eyebrow="3 items" title="Trash" lede="Kept for 30 days, then removed for good. You can put anything back before then." right={<span style={{ ...act, color: 'var(--rf-text-4)' }}>← Mirror</span>} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {TRASHED.map((e, i) => (
            <RfSheet key={i} style={{ padding: '15px 24px' }}>
              <p style={{ margin: 0, fontFamily: F.display, fontSize: 16, lineHeight: 1.55, color: e.p ? 'var(--rf-text)' : 'var(--rf-text-4)' }}>{e.p || 'Empty entry'}</p>
              <div style={{ marginTop: 9, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px' }}>
                <RfEyebrow size={9.5}>{e.d}</RfEyebrow>
                <span style={{ ...act, color: e.left <= 3 ? 'var(--rf-warn)' : 'var(--rf-text-4)' }}>{e.left} days left</span>
                <span style={{ ...act, color: 'var(--rf-text-2)' }}>Put it back</span>
                {e.confirming
                  ? <><span style={{ ...act, color: 'var(--rf-text-3)' }}>Gone for good?</span><span style={{ ...act, color: 'var(--rf-error)' }}>Yes, delete it</span><span style={{ ...act, color: 'var(--rf-text-4)' }}>Cancel</span></>
                  : <span style={{ ...act, color: 'var(--rf-text-4)' }}>Delete now</span>}
              </div>
            </RfSheet>
          ))}
        </div>
        <p style={{ margin: '14px 0 0', maxWidth: 520, fontSize: 11.5, lineHeight: 1.6, color: 'var(--rf-text-4)' }}>That deletion is real — the text is destroyed, not hidden, and cannot be recovered afterwards.</p>
      </Column>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 24, display: 'flex', justifyContent: 'center' }}><RfToast>Put back</RfToast></div>
    </RfPageBg>
  );
}

// ── Component sheet ──────────────────────────────────────────────────────
function Spec({ children }) {
  return <p style={{ margin: '12px 0 0', fontFamily: F.mono, fontSize: 10, lineHeight: 1.6, color: 'var(--rf-text-3)' }}>{children}</p>;
}

function Cell({ title, status, children, spec, span = 1 }) {
  return (
    <div style={{ gridColumn: `span ${span}`, padding: '18px 20px 20px', borderRadius: 4, background: 'var(--rf-paper)', boxShadow: 'inset 0 0 0 1px var(--rf-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <RfEyebrow>{title}</RfEyebrow>
        <RfBadge variant={status === 'New' ? 'accent' : 'neutral'}>{status}</RfBadge>
      </div>
      {children}
      {spec && <Spec>{spec}</Spec>}
    </div>
  );
}

function OldToast() {
  return <div style={{ display: 'inline-block', padding: '10px 16px', borderRadius: 12, background: '#292524', color: '#fff', fontSize: 14, fontFamily: F.sans, boxShadow: '0 10px 15px -3px rgba(0,0,0,.1)' }}>Put back</div>;
}

function ScreenComponents({ palette, dark }) {
  return (
    <RfPageBg>
      <div style={{ padding: '34px 40px 0', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <RfEyebrow>Component refresh · v3.1 · {PALETTES[palette].name} · {dark ? 'Dark' : 'Light'}</RfEyebrow>
          <h1 style={{ margin: '10px 0 0', fontFamily: F.display, fontSize: 30, fontWeight: 380, letterSpacing: '-0.02em' }}>What was still off-system</h1>
        </div>
        <p style={{ margin: 0, maxWidth: 380, fontSize: 12.5, lineHeight: 1.6, color: 'var(--rf-text-3)' }}>Everything below reads only --rf-* tokens, so it follows Dawn, Dusk and Slate without per-palette code.</p>
      </div>
      <div style={{ padding: '22px 40px 40px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 14 }}>
        <Cell title="Toast" status="Refreshed" spec="ui/toast.tsx · pill · --rf-text on --rf-paper · 13px Geist · --rf-sheet-shadow · position unchanged">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ opacity: 0.55 }}><OldToast /></div>
            <span style={{ color: 'var(--rf-text-4)' }}>→</span>
            <RfToast>Put back</RfToast>
          </div>
        </Cell>
        <Cell title="Notice" status="New" spec="ui/notice.tsx · error | warn | quiet · 4px · 12.5/1.55 · replaces text-red-600, rgba(163,58,37,.08) and rounded-[10px]">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <RfNotice>That invite code isn't valid.</RfNotice>
            <RfNotice tone="warn">This describes an earlier version of the entry.</RfNotice>
            <RfNotice tone="quiet">Nothing matches these filters.</RfNotice>
          </div>
        </Cell>
        <Cell title="Badge" status="Refreshed" spec="ui/badge.tsx · mono 9px · 0.14em · pill · stone/green classes → tokens. tier-0…3 stay as-is (admin only)">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <RfBadge variant="active">Your version</RfBadge>
            <RfBadge variant="accent">Framework</RfBadge>
            <RfBadge variant="ended">Ended</RfBadge>
            <RfBadge>Neutral</RfBadge>
          </div>
        </Cell>
        <Cell title="Section label" status="Refreshed" spec="ui/section-label.tsx · becomes <h2> wrapping Eyebrow · was text-xs font-semibold text-stone-400">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontFamily: F.sans, fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a8a29e', opacity: 0.7 }}>Recent</span>
            <RfEyebrow>Recent</RfEyebrow>
          </div>
        </Cell>
        <Cell title="Text field" status="Refreshed" spec="auth pages · --rf-surface · inset --rf-border · 4px · focus: --rf-paper + inset --rf-accent · visible labels">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <RfInput id="c1" label="Email address" value="" placeholder="" />
            <RfInput id="c2" label="Invite code" value="RF-7K2Q-MOSS" mono focus />
          </div>
        </Cell>
        <Cell title="Buttons" status="Refreshed" spec="auth submit was rounded-md bg-stone-800 → ink pill, same as Profile · Save and Feedback · Send">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
            <RfBtn full>Sign in</RfBtn>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}><RfBtn variant="outline" size="sm">Apply</RfBtn><RfBtn variant="text">Cancel</RfBtn></div>
          </div>
        </Cell>
        <Cell title="Palette picker" status="New" span={2} spec="settings/profile · radiogroup · each preview in its own PaletteFrame · ring in current --rf-accent · PATCH /api/user/preferences { palette }">
          <PalettePicker value={palette} dark={dark} />
        </Cell>
        <Cell title="Overlay scrim" status="Refreshed" spec="journal-guidance-sidebar.tsx:282 · rgba(40,28,12,.18) → var(--rf-scrim)">
          <div style={{ position: 'relative', height: 132, borderRadius: 3, overflow: 'hidden', background: 'var(--rf-bg)' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'var(--rf-scrim)' }}></div>
            <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '58%', background: 'var(--rf-surface)', borderLeft: '1px solid var(--rf-border)', padding: 12, boxSizing: 'border-box' }}><RfEyebrow size={9}>Footholds</RfEyebrow></div>
          </div>
        </Cell>
      </div>
    </RfPageBg>
  );
}

Object.assign(window, { ScreenProfile, ScreenAuth, ScreenArchive, ScreenTrash, ScreenComponents });
