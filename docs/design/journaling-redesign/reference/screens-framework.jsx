// Refine v3 — framework mode (questionnaires), tracker check-in, and the
// closing surface after an entry is set down.
//
// Framework mode is a SEPARATE mode picked on Home, not something Refine
// injects into an open entry. Instruments are shown as instruments: one
// scrollable page, tight, form-like, no clinical styling.

const GAD7 = [
  ['Feeling nervous, anxious, or on edge', 2],
  ['Not being able to stop or control worrying', 3],
  ['Worrying too much about different things', 2],
  ['Trouble relaxing', 2],
  ['Being so restless that it’s hard to sit still', 1],
  ['Becoming easily annoyed or irritable', 2],
  ['Feeling afraid as if something awful might happen', 0],
];

const SCALE_LABELS = ['Not at all', 'Several days', 'Over half the days', 'Nearly every day'];

function ScaleHeader() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 22, paddingBottom: 8, borderBottom: '1px solid var(--rf-border)' }}>
      <Eyebrow size={9.5} style={{ letterSpacing: '0.16em' }}>Over the last two weeks</Eyebrow>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {SCALE_LABELS.map((l, i) => (
          <span key={i} style={{ fontFamily: REFINE_FONT.mono, fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--rf-text-4)', textAlign: 'center', lineHeight: 1.35, padding: '0 3px' }}>{l}</span>
        ))}
      </div>
    </div>
  );
}

function ScreenFramework() {
  return (
    <PageBg>
      <TopNav active="today" />
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '22px 40px 0', minHeight: 0 }}>
        <div style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, paddingBottom: 14 }}>
            <div>
              <Eyebrow color="var(--rf-accent)">Framework · GAD-7</Eyebrow>
              <h1 style={{ margin: '8px 0 4px', fontFamily: REFINE_FONT.display, fontSize: 27, fontWeight: 380, letterSpacing: '-0.02em', color: 'var(--rf-text)' }}>Generalised anxiety</h1>
              <p style={{ margin: 0, fontFamily: REFINE_FONT.body, fontSize: 13, color: 'var(--rf-text-3)' }}>Seven questions. Under two minutes. Answer roughly — precision isn’t the point.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              <Chip soft accent>Every 2 weeks</Chip>
              <Eyebrow size={9.5} style={{ letterSpacing: '0.14em' }}>Last taken 14 Jul</Eyebrow>
            </div>
          </div>
          <Sheet style={{ padding: '14px 30px 18px' }}>
            <ScaleHeader />
            {GAD7.map(([q, sel], i) => (
              <ScaleRow key={i} n={i + 1} question={q} selected={sel} last={i === GAD7.length - 1} />
            ))}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--rf-border)' }}>
              <Eyebrow size={9.5} style={{ letterSpacing: '0.16em' }}>In your own words · optional</Eyebrow>
              <p style={{ margin: '8px 0 10px', fontFamily: REFINE_FONT.display, fontSize: 16.5, lineHeight: 1.55, color: 'var(--rf-text-3)', fontStyle: 'italic' }}>
                The restlessness is mostly evenings, after I stop working.<span className="rf3-caret" />
              </p>
              <MicPill label="Speak instead" />
            </div>
          </Sheet>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, padding: '14px 0 18px' }}>
            <p style={{ margin: 0, fontFamily: REFINE_FONT.body, fontSize: 12, color: 'var(--rf-text-4)', maxWidth: 380, lineHeight: 1.5 }}>Scored and kept in Mirror. You’ll see the trend over time — never a diagnosis.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <Btn ghost size="sm">Finish later</Btn>
              <Btn primary>Record answers</Btn>
            </div>
          </div>
        </div>
      </div>
    </PageBg>
  );
}

// ── Tracker check-in ────────────────────────────────────────────────────────
// Deliberately 15 seconds. Rendered both as its own screen and as the Home
// strip (see TrackerStrip) so the placement question stays open.

function StepScale({ n = 5, selected = 3, labels }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {Array.from({ length: n }).map((_, i) => (
          <span key={i} style={{ width: 34, height: 30, borderRadius: 4, display: 'grid', placeItems: 'center', background: i === selected ? 'var(--rf-accent)' : 'transparent', boxShadow: i === selected ? 'none' : 'inset 0 0 0 1px var(--rf-border)', fontFamily: REFINE_FONT.mono, fontSize: 11, color: i === selected ? 'var(--rf-paper)' : 'var(--rf-text-3)' }}>{i + 1}</span>
        ))}
      </div>
      {labels && <div style={{ display: 'flex', justifyContent: 'space-between', width: 34 * n + 6 * (n - 1) }}>{labels.map((l, i) => <Eyebrow key={i} size={9} style={{ letterSpacing: '0.12em' }}>{l}</Eyebrow>)}</div>}
    </div>
  );
}

function CheckRow({ label, children, note, last }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 24, alignItems: 'center', padding: '15px 0', borderBottom: last ? 'none' : '1px solid var(--rf-rule)' }}>
      <div>
        <p style={{ margin: 0, fontFamily: REFINE_FONT.display, fontSize: 16.5, color: 'var(--rf-text)' }}>{label}</p>
        {note && <p style={{ margin: '2px 0 0', fontFamily: REFINE_FONT.body, fontSize: 11.5, color: 'var(--rf-text-4)' }}>{note}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function HabitToggles({ items }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {items.map(([label, on], i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 999, background: on ? 'var(--rf-accent-2-soft)' : 'transparent', boxShadow: on ? 'inset 0 0 0 1px var(--rf-accent-2)' : 'inset 0 0 0 1px var(--rf-border)', fontFamily: REFINE_FONT.body, fontSize: 12.5, color: on ? 'var(--rf-text)' : 'var(--rf-text-3)' }}>
          <span style={{ width: 13, height: 13, borderRadius: 3, background: on ? 'var(--rf-accent-2)' : 'transparent', boxShadow: on ? 'none' : 'inset 0 0 0 1px var(--rf-border-strong)', display: 'grid', placeItems: 'center' }}>
            {on && <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="var(--rf-paper)" strokeWidth="1.6" strokeLinecap="round"><path d="M1.5 4.2 L3.2 6 L6.5 2.2" /></svg>}
          </span>
          {label}
        </span>
      ))}
    </div>
  );
}

function ScreenCheckin() {
  return (
    <PageBg>
      <TopNav active="today" />
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '40px 40px 0' }}>
        <div style={{ width: '100%', maxWidth: 660 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 18 }}>
            <div>
              <Eyebrow color="var(--rf-accent)">Daily check-in</Eyebrow>
              <h1 style={{ margin: '10px 0 4px', fontFamily: REFINE_FONT.display, fontSize: 30, fontWeight: 380, letterSpacing: '-0.02em' }}>Tuesday, 28 July</h1>
              <p style={{ margin: 0, fontFamily: REFINE_FONT.body, fontSize: 13, color: 'var(--rf-text-3)' }}>Four taps. Then write, or don’t.</p>
            </div>
            <Eyebrow size={9.5} style={{ letterSpacing: '0.14em' }}>19 of 21 days logged</Eyebrow>
          </div>
          <Sheet style={{ padding: '10px 30px 22px' }}>
            <CheckRow label="Slept" note="Hours, roughly">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontFamily: REFINE_FONT.display, fontSize: 26, color: 'var(--rf-text)' }}>5.5</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['−', '+'].map((s) => <span key={s} style={{ width: 28, height: 28, borderRadius: 4, display: 'grid', placeItems: 'center', boxShadow: 'inset 0 0 0 1px var(--rf-border)', fontFamily: REFINE_FONT.mono, fontSize: 13, color: 'var(--rf-text-2)' }}>{s}</span>)}
                </div>
                <Chip style={{ marginLeft: 6 }}>2h under your median</Chip>
              </div>
            </CheckRow>
            <CheckRow label="Mood" note="Now, not the whole day">
              <StepScale selected={2} labels={['Low', 'Even', 'Good']} />
            </CheckRow>
            <CheckRow label="Energy">
              <StepScale selected={1} labels={['Empty', 'Fine', 'Full']} />
            </CheckRow>
            <CheckRow label="Kept up" note="Tap what happened" last>
              <HabitToggles items={[['Medication', true], ['Moved', true], ['Outside', false], ['Alcohol', false], ['Screens after 11', true]]} />
            </CheckRow>
          </Sheet>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, padding: '18px 0' }}>
            <p style={{ margin: 0, fontFamily: REFINE_FONT.body, fontSize: 12, color: 'var(--rf-text-4)', maxWidth: 340, lineHeight: 1.5 }}>Feeds the trends in Mirror. No streaks, no reminders unless you ask.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <Btn size="sm">Log and stop</Btn>
              <Btn primary>Log, then write</Btn>
            </div>
          </div>
        </div>
      </div>
    </PageBg>
  );
}

// ── After the entry: the closing surface ────────────────────────────────────

function MirrorCatch({ text, kind }) {
  return (
    <div style={{ padding: '14px 0', borderTop: '1px solid var(--rf-rule)', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
      <div style={{ flex: 1 }}>
        <Eyebrow size={9.5} color="var(--rf-text-4)" style={{ letterSpacing: '0.16em' }}>{kind}</Eyebrow>
        <p style={{ margin: '7px 0 0', fontFamily: REFINE_FONT.display, fontSize: 16, lineHeight: 1.5, color: 'var(--rf-text)', textWrap: 'pretty' }}>{text}</p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0, paddingTop: 4 }}>
        <span style={{ fontFamily: REFINE_FONT.mono, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--rf-accent-2)', padding: '5px 11px', borderRadius: 999, background: 'var(--rf-accent-2-soft)' }}>Keep</span>
        <span style={{ fontFamily: REFINE_FONT.mono, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--rf-text-3)', padding: '5px 11px', borderRadius: 999, boxShadow: 'inset 0 0 0 1px var(--rf-border)' }}>Drop</span>
      </div>
    </div>
  );
}

function ScreenComplete() {
  return (
    <PageBg>
      <TopNav active="today" />
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '54px 40px 0' }}>
        <div style={{ width: '100%', maxWidth: 640 }}>
          <Eyebrow color="var(--rf-accent)">Set down · 9:19</Eyebrow>
          <h1 style={{ margin: '14px 0 10px', fontFamily: REFINE_FONT.display, fontSize: 36, fontWeight: 380, lineHeight: 1.12, letterSpacing: '-0.022em' }}>
            On not wanting <em>the promotion</em>
          </h1>
          <p style={{ margin: '0 0 6px', fontFamily: REFINE_FONT.body, fontSize: 13, color: 'var(--rf-text-3)' }}>Titled for you. <span style={{ borderBottom: '1px solid var(--rf-border-strong)' }}>Rename it</span> if that’s wrong.</p>
          <div style={{ marginTop: 28 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Eyebrow>Caught for the Mirror</Eyebrow>
              <Eyebrow size={9.5} style={{ letterSpacing: '0.14em' }}>Nothing is kept unless you say so</Eyebrow>
            </div>
            <div style={{ marginTop: 12 }}>
              <MirrorCatch kind="Fact" text="Doesn’t want the promotion — named it for the first time on 28 Jul." />
              <MirrorCatch kind="Thread · Sleep" text="Fourth night of poor sleep in seven days; attributes it to the deadline." />
              <MirrorCatch kind="Pattern" text="Says “it’s the deadline” when the topic is really wanting something else." />
            </div>
          </div>
          <div style={{ marginTop: 30, paddingTop: 20, borderTop: '1px solid var(--rf-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
            <p style={{ margin: 0, fontFamily: REFINE_FONT.display, fontSize: 16, fontStyle: 'italic', color: 'var(--rf-text-3)' }}>That’s enough for today.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <Btn size="sm">Read it back</Btn>
              <Btn primary>Done</Btn>
            </div>
          </div>
        </div>
      </div>
    </PageBg>
  );
}

Object.assign(window, { ScreenFramework, ScreenCheckin, ScreenComplete, StepScale, HabitToggles, MirrorCatch, GAD7, SCALE_LABELS });
