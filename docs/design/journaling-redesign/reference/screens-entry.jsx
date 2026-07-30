// Refine v3 — the entry. This is the centre of the product now.
//
// UX brief: get people to FINISH entries without feeling like they're writing
// essays. Devices used here, in order of importance:
//   1. The sheet is short and bounded — it looks fillable, not infinite.
//   2. A descriptive norm sits under the text ("three or four sentences") so
//      the user calibrates down, not up. No word count, no progress bar.
//   3. Prompts are OPTIONAL FOOTHOLDS in a collapsible rail, offered once at
//      the start. They never appear inline and never interrupt.
//   4. Finishing is one obvious button that costs nothing: "Set it down".

const ENTRY_TEXT = [
  'Slept badly again and the whole morning had that thin quality to it. I keep telling myself it’s the deadline, but I’ve been saying that since March.',
  'The part I didn’t say in standup: I don’t think I actually want the promotion.',
];

const FOOTHOLDS = [
  { src: 'Open prompt', q: 'What’s taking up the most room in your head right now?' },
  { src: 'From Sun 26 Jul', q: 'You left off wondering whether the tiredness was the work or the wanting. Any clearer today?' },
  { src: 'Thread · Sleep', q: 'Third mention of bad sleep this week. What’s different about the nights that go well?' },
];

function SheetHeader({ label = 'Open reflection', time = 'Tue 28 Jul · 9:12' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottom: '1px solid var(--rf-rule)' }}>
      <Eyebrow color="var(--rf-accent)">{label}</Eyebrow>
      <Eyebrow style={{ letterSpacing: '0.1em' }}>{time}</Eyebrow>
    </div>
  );
}

function EntryParagraph({ children, dim, caret }) {
  return (
    <p style={{ margin: 0, fontFamily: REFINE_FONT.display, fontSize: 18.5, lineHeight: 1.62, color: dim ? 'var(--rf-text-3)' : 'var(--rf-text)', letterSpacing: '-0.003em', textWrap: 'pretty' }}>
      {children}{caret && <span className="rf3-caret" />}
    </p>
  );
}

// The norm line — the single most important anti-essay device on this screen.
function NormLine({ children = 'Most entries here run three or four sentences. Stop when you’ve said the true thing.' }) {
  return <p style={{ margin: 0, fontFamily: REFINE_FONT.body, fontSize: 12, lineHeight: 1.5, color: 'var(--rf-text-4)', maxWidth: 420 }}>{children}</p>;
}

function FootholdRail({ collapsed, count = 3 }) {
  if (collapsed) {
    return (
      <aside style={{ width: 48, borderLeft: '1px solid var(--rf-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 22, gap: 16, flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--rf-text-3)" strokeWidth="1.4" strokeLinecap="round"><path d="M9 3 L4.5 7 L9 11" /></svg>
        <span style={{ fontFamily: REFINE_FONT.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--rf-text-3)', writingMode: 'vertical-rl', marginTop: 4 }}>Footholds</span>
        <span style={{ fontFamily: REFINE_FONT.mono, fontSize: 10, color: 'var(--rf-accent)', width: 18, height: 18, borderRadius: 99, background: 'var(--rf-accent-soft)', display: 'grid', placeItems: 'center' }}>{count}</span>
      </aside>
    );
  }
  return (
    <aside style={{ width: 306, borderLeft: '1px solid var(--rf-border)', padding: '22px 26px 20px', display: 'flex', flexDirection: 'column', gap: 18, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <Eyebrow>Footholds</Eyebrow>
          <p style={{ margin: '7px 0 0', fontFamily: REFINE_FONT.body, fontSize: 12, lineHeight: 1.5, color: 'var(--rf-text-3)', maxWidth: 210 }}>Offered once, at the start. Use one or ignore them all.</p>
        </div>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--rf-text-3)" strokeWidth="1.4" strokeLinecap="round" style={{ marginTop: 2 }}><path d="M5 3 L9.5 7 L5 11" /></svg>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {FOOTHOLDS.map((f, i) => (
          <div key={i} style={{ padding: '15px 0', borderTop: '1px solid var(--rf-rule)' }}>
            <Eyebrow size={9.5} color={i === 0 ? 'var(--rf-text-4)' : 'var(--rf-accent)'} style={{ letterSpacing: '0.16em' }}>{f.src}</Eyebrow>
            <p style={{ margin: '8px 0 10px', fontFamily: REFINE_FONT.display, fontSize: 15.5, lineHeight: 1.5, color: 'var(--rf-text-2)', textWrap: 'pretty' }}>{f.q}</p>
            <span style={{ fontFamily: REFINE_FONT.mono, fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--rf-text-3)', borderBottom: '1px solid var(--rf-border-strong)', paddingBottom: 2 }}>Start here</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid var(--rf-rule)' }}>
        <Eyebrow size={9.5} style={{ letterSpacing: '0.16em' }}>Dismiss all · write cold</Eyebrow>
      </div>
    </aside>
  );
}

function EntryActionBar({ voice, recording }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <MicPill recording={!!recording} />
        <span style={{ fontFamily: REFINE_FONT.mono, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--rf-text-4)' }}>Saved 9:14</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Btn ghost size="sm">Keep for later</Btn>
        <Btn primary>Set it down</Btn>
      </div>
    </div>
  );
}

// ── Screen: open reflection, writing ────────────────────────────────────────

function ScreenWrite({ collapsed = false, empty = false }) {
  return (
    <PageBg>
      <TopNav active="today" />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '38px 40px 30px', minWidth: 0 }}>
          <div style={{ width: '100%', maxWidth: 620 }}>
            <Sheet style={{ padding: '26px 34px 22px', minHeight: 330, display: 'flex', flexDirection: 'column' }}>
              <SheetHeader />
              <div style={{ paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
                {empty ? (
                  <EntryParagraph dim caret>Start anywhere. A sentence is a whole entry.</EntryParagraph>
                ) : (
                  <React.Fragment>
                    <EntryParagraph>{ENTRY_TEXT[0]}</EntryParagraph>
                    <EntryParagraph caret>{ENTRY_TEXT[1]}</EntryParagraph>
                  </React.Fragment>
                )}
              </div>
              <div style={{ paddingTop: 18, borderTop: '1px solid var(--rf-rule)' }}>
                <NormLine />
              </div>
            </Sheet>
            <EntryActionBar />
          </div>
        </div>
        <FootholdRail collapsed={collapsed} />
      </div>
    </PageBg>
  );
}

// ── Screen: open reflection, dictating ──────────────────────────────────────
// Same entry, same sheet. Voice only changes how words arrive.

function ScreenVoice() {
  return (
    <PageBg>
      <TopNav active="today" />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 40px 26px', minWidth: 0 }}>
          <div style={{ width: '100%', maxWidth: 620 }}>
            <Sheet style={{ padding: '26px 34px 22px', minHeight: 330, display: 'flex', flexDirection: 'column' }}>
              <SheetHeader label="Open reflection · dictating" />
              <div style={{ paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                <EntryParagraph>{ENTRY_TEXT[0]}</EntryParagraph>
                <EntryParagraph>{ENTRY_TEXT[1]}</EntryParagraph>
                <EntryParagraph dim caret>and I think if I say that out loud to anyone it becomes</EntryParagraph>
              </div>
              <div style={{ paddingTop: 16, borderTop: '1px solid var(--rf-rule)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Waveform bars={26} height={20} />
                  <span style={{ fontFamily: REFINE_FONT.mono, fontSize: 11.5, color: 'var(--rf-accent)', letterSpacing: '0.06em' }}>1:08</span>
                </div>
                <Eyebrow size={9.5} style={{ letterSpacing: '0.16em' }}>Transcribing · edit anything after</Eyebrow>
              </div>
            </Sheet>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <DictationDisc size={78} />
                <div>
                  <p style={{ margin: 0, fontFamily: REFINE_FONT.display, fontSize: 17, color: 'var(--rf-text)' }}>Listening</p>
                  <p style={{ margin: '4px 0 0', fontFamily: REFINE_FONT.body, fontSize: 12, color: 'var(--rf-text-3)', maxWidth: 240, lineHeight: 1.5 }}>Pause any time. Nothing is sent until you set it down.</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Btn size="sm">Pause</Btn>
                <Btn primary>Set it down</Btn>
              </div>
            </div>
          </div>
        </div>
        <FootholdRail collapsed />
      </div>
    </PageBg>
  );
}

// ── Mobile: the same entry, thumb-first ─────────────────────────────────────

function MobileWrite({ recording = false }) {
  return (
    <PageBg>
      <div style={{ padding: '14px 18px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontFamily: REFINE_FONT.mono, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--rf-text-3)' }}>Close</span>
        <Wordmark size={16} />
        <span style={{ fontFamily: REFINE_FONT.mono, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--rf-accent)' }}>Set down</span>
      </div>
      <div style={{ flex: 1, padding: '8px 14px 0', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Sheet style={{ padding: '18px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <SheetHeader time="Tue 28 Jul" />
          <div style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
            <EntryParagraph>{ENTRY_TEXT[0]}</EntryParagraph>
            <EntryParagraph caret={!recording}>{ENTRY_TEXT[1]}</EntryParagraph>
            {recording && <EntryParagraph dim caret>and I think if I say that out loud it becomes</EntryParagraph>}
          </div>
          <div style={{ paddingTop: 14, borderTop: '1px solid var(--rf-rule)' }}>
            <NormLine>Three or four sentences is a full entry.</NormLine>
          </div>
        </Sheet>
      </div>
      {/* Footholds as a peeking sheet — collapsed by default on mobile */}
      <div style={{ margin: '12px 14px 0', padding: '14px 18px', borderRadius: '10px 10px 0 0', background: 'var(--rf-surface)', border: '1px solid var(--rf-border)', borderBottom: 'none' }}>
        <div style={{ width: 34, height: 3, borderRadius: 99, background: 'var(--rf-border-strong)', margin: '0 auto 12px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Eyebrow>Footholds</Eyebrow>
          <span style={{ fontFamily: REFINE_FONT.mono, fontSize: 10, color: 'var(--rf-accent)' }}>3</span>
        </div>
        <p style={{ margin: '9px 0 0', fontFamily: REFINE_FONT.display, fontSize: 15, lineHeight: 1.45, color: 'var(--rf-text-2)' }}>{FOOTHOLDS[0].q}</p>
      </div>
      <div style={{ padding: '14px 18px 26px', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--rf-surface)', borderTop: '1px solid var(--rf-border)' }}>
        <MicPill recording={recording} label="Speak" />
        <span style={{ marginLeft: 'auto', fontFamily: REFINE_FONT.mono, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--rf-text-4)' }}>Saved</span>
      </div>
    </PageBg>
  );
}

Object.assign(window, { ScreenWrite, ScreenVoice, MobileWrite, FootholdRail, Sheet, SheetHeader, EntryParagraph, NormLine, ENTRY_TEXT, FOOTHOLDS });
