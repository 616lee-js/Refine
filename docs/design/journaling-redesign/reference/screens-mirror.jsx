// Refine v3 — Mirror (now holds structured tracker + instrument history as
// well as facts and threads) and onboarding.

function MirrorTabs({ active = 'trends' }) {
  const tabs = [['threads', 'Threads'], ['facts', 'Facts'], ['trends', 'Trends']];
  return (
    <div style={{ display: 'flex', gap: 26, borderBottom: '1px solid var(--rf-border)' }}>
      {tabs.map(([k, l]) => (
        <span key={k} style={{ paddingBottom: 11, fontFamily: REFINE_FONT.body, fontSize: 13.5, color: active === k ? 'var(--rf-text)' : 'var(--rf-text-3)', fontWeight: active === k ? 500 : 400, borderBottom: active === k ? '1px solid var(--rf-accent)' : '1px solid transparent', marginBottom: -1 }}>{l}</span>
      ))}
    </div>
  );
}

function MirrorHead({ tab }) {
  return (
    <div style={{ paddingBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, paddingBottom: 14 }}>
        <div>
          <Eyebrow color="var(--rf-accent)">Mirror</Eyebrow>
          <h1 style={{ margin: '8px 0 5px', fontFamily: REFINE_FONT.display, fontSize: 27, fontWeight: 380, letterSpacing: '-0.02em' }}>What Refine has of you</h1>
          <p style={{ margin: 0, fontFamily: REFINE_FONT.body, fontSize: 13, color: 'var(--rf-text-3)', maxWidth: 480 }}>Everything here came from your own entries and check-ins. Confirm it, correct it, or take it out.</p>
        </div>
        <Btn size="sm">Export everything</Btn>
      </div>
      <MirrorTabs active={tab} />
    </div>
  );
}

function ChartCard({ label, meta, reading, note, children, span }) {
  return (
    <Sheet style={{ padding: '14px 20px 13px', gridColumn: span ? '1 / -1' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <Eyebrow>{label}</Eyebrow>
          {reading && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 6 }}>
              <span style={{ fontFamily: REFINE_FONT.display, fontSize: 27, lineHeight: 1, color: 'var(--rf-text)' }}>{reading}</span>
              {note && <span style={{ fontFamily: REFINE_FONT.body, fontSize: 12.5, color: 'var(--rf-text-3)' }}>{note}</span>}
            </div>
          )}
        </div>
        {meta && <Eyebrow size={9.5} style={{ letterSpacing: '0.14em', textAlign: 'right', maxWidth: 130, lineHeight: 1.5 }}>{meta}</Eyebrow>}
      </div>
      <div style={{ marginTop: 11 }}>{children}</div>
    </Sheet>
  );
}

const WEEKS = ['16 Jun', '', '30 Jun', '', '14 Jul', '', '28 Jul'];

function MirrorTrends({ part = 1 }) {
  if (part === 2) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 30 }}>
        <ChartCard span label="Kept up · last 21 days" meta="Two of five things drift on the weeks anxiety runs high">
          <DotMatrix cols={21} rows={[
            { label: 'Medication', days: [2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2] },
            { label: 'Moved', days: [2, 0, 2, 1, 0, 2, 2, 0, 1, 2, 0, 0, 2, 1, 2, 0, 0, 1, 2, 2, 0] },
            { label: 'Outside', days: [2, 2, 0, 2, 2, 2, 0, 1, 2, 2, 2, 0, 0, 2, 1, 2, 2, 0, 0, 1, 0] },
            { label: 'No alcohol', days: [2, 2, 2, 0, 0, 2, 2, 2, 2, 0, 2, 2, 2, 2, 0, 0, 2, 2, 2, 2, 2] },
            { label: 'Off screens by 11', days: [0, 1, 0, 0, 2, 0, 1, 2, 0, 0, 1, 0, 0, 2, 0, 1, 0, 0, 2, 0, 0] },
          ]} />
        </ChartCard>
        <Sheet style={{ padding: '20px 24px' }}>
          <Eyebrow>Plainly</Eyebrow>
          <p style={{ margin: '12px 0 0', fontFamily: REFINE_FONT.display, fontSize: 18, lineHeight: 1.6, color: 'var(--rf-text)', maxWidth: 620, textWrap: 'pretty' }}>
            Over six weeks the anxiety readings have climbed while the low-mood ones
            have fallen. The weeks that run high are the weeks with under six hours
            of sleep and no time spent outside.
          </p>
          <p style={{ margin: '12px 0 0', fontFamily: REFINE_FONT.body, fontSize: 12.5, lineHeight: 1.55, color: 'var(--rf-text-4)', maxWidth: 560 }}>
            A description of what you logged, not a diagnosis. Bring it to someone
            qualified if it looks worth acting on.
          </p>
        </Sheet>
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, paddingBottom: 30 }}>
      <ChartCard label="Anxiety · GAD-7" reading="12" note="moderate · up 4 since 11 Jul" meta="7 readings · fortnightly">
        <LineChart data={[6, 8, 7, 11, 10, 13, 12]} w={420} h={112} max={21} labels={WEEKS} bands={[{ from: 10, to: 21, color: 'var(--rf-warn-soft)' }]} />
      </ChartCard>
      <ChartCard label="Low mood · PHQ-9" reading="9" note="mild · down 5 since June" meta="6 readings · fortnightly">
        <LineChart data={[14, 13, 12, 11, 10, 9]} w={420} h={112} max={27} labels={['16 Jun', '', '30 Jun', '', '14 Jul', '28 Jul']} color="var(--rf-accent-2)" />
      </ChartCard>
      <ChartCard label="Sleep · hours" reading="5.5" note="median 6.2 over 21 days" meta="From daily check-ins">
        <LineChart data={[7, 6.5, 6, 5, 6.5, 5.5, 5.5]} w={420} h={112} max={9} labels={['', '', '', '', '', '', 'today']} color="var(--rf-accent-2)" />
      </ChartCard>
      <ChartCard label="Entries written" reading="19" note="of the last 21 days" meta="Recorded, not rewarded">
        <LineChart data={[4, 5, 6, 7, 6, 7, 6]} w={420} h={112} max={7} labels={['', '', '', '', '', '', 'wk 30']} />
      </ChartCard>
    </div>
  );
}

function ThreadRow({ title, mentions, last, summary }) {
  return (
    <div style={{ padding: '13px 0', borderTop: '1px solid var(--rf-rule)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
        <span style={{ fontFamily: REFINE_FONT.display, fontSize: 18, color: 'var(--rf-text)', letterSpacing: '-0.012em' }}>{title}</span>
        <Eyebrow size={9.5} style={{ letterSpacing: '0.12em' }}>{mentions} entries · last {last}</Eyebrow>
      </div>
      <p style={{ margin: '7px 0 0', fontFamily: REFINE_FONT.display, fontSize: 15.5, lineHeight: 1.55, color: 'var(--rf-text-2)', textWrap: 'pretty' }}>{summary}</p>
    </div>
  );
}

function FactRow({ text, src }) {
  return (
    <div style={{ padding: '10px 0', borderTop: '1px solid var(--rf-rule)', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontFamily: REFINE_FONT.body, fontSize: 13, lineHeight: 1.55, color: 'var(--rf-text)' }}>{text}</p>
        <p style={{ margin: '4px 0 0', fontFamily: REFINE_FONT.mono, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--rf-text-4)' }}>{src}</p>
      </div>
      <span style={{ fontFamily: REFINE_FONT.mono, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--rf-text-3)', flexShrink: 0, paddingTop: 2 }}>Edit</span>
    </div>
  );
}

function MirrorThreads() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 40, paddingBottom: 30 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Eyebrow>Threads · what keeps coming back</Eyebrow>
          <Eyebrow size={9.5} style={{ letterSpacing: '0.14em' }}>Sorted by recency</Eyebrow>
        </div>
        <div style={{ marginTop: 8 }}>
          <ThreadRow title="Sleep" mentions={11} last="today" summary="Poor sleep is named on four of the last seven nights, always attributed to the deadline rather than to worry." />
          <ThreadRow title="The promotion" mentions={6} last="today" summary="Wanting it has never actually been stated. Today the opposite was, for the first time." />
          <ThreadRow title="Dad" mentions={9} last="24 Jul" summary="Calls go better when they aren’t about the flat. One good call recorded this month." />
          <ThreadRow title="Evenings" mentions={7} last="25 Jul" summary="Restlessness clusters after work stops — mentioned again in the GAD-7 note." />
        </div>
      </div>
      <aside style={{ borderLeft: '1px solid var(--rf-border)', paddingLeft: 28 }}>
        <div style={{ padding: '14px 16px', borderRadius: 4, background: 'var(--rf-accent-soft)', border: '1px solid var(--rf-border)' }}>
          <Eyebrow color="var(--rf-accent)" size={9.5} style={{ letterSpacing: '0.16em' }}>3 waiting on you</Eyebrow>
          <p style={{ margin: '8px 0 0', fontFamily: REFINE_FONT.body, fontSize: 12.5, lineHeight: 1.55, color: 'var(--rf-text-2)' }}>Refine caught these today but won’t keep them until you confirm.</p>
        </div>
        <div style={{ marginTop: 22 }}>
          <Eyebrow>Facts</Eyebrow>
          <div style={{ marginTop: 8 }}>
            <FactRow text="Works as a design lead; deadline pressure since March." src="From 8 entries" />
            <FactRow text="Takes sertraline, mornings." src="Confirmed 14 Jun" />
            <FactRow text="Sister, Ellie — the person she calls first." src="From 4 entries" />
            <FactRow text="Prefers to write in the morning, speak at night." src="Observed" />
          </div>
        </div>
      </aside>
    </div>
  );
}

function ScreenMirror({ tab = 'trends', part = 1 }) {
  return (
    <PageBg>
      <TopNav active="mirror" />
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '24px 46px 0', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ width: '100%', maxWidth: 900 }}>
          <MirrorHead tab={tab} />
          <div style={{ paddingTop: 16 }}>{tab === 'threads' ? <MirrorThreads /> : <MirrorTrends part={part} />}</div>
        </div>
      </div>
    </PageBg>
  );
}

// ── Onboarding ──────────────────────────────────────────────────────────────

function PickChip({ label, sub, on }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '12px 16px', borderRadius: 4, background: on ? 'var(--rf-accent-soft)' : 'var(--rf-paper)', boxShadow: on ? 'inset 0 0 0 1px var(--rf-accent)' : 'inset 0 0 0 1px var(--rf-border)' }}>
      <span style={{ fontFamily: REFINE_FONT.display, fontSize: 16, color: 'var(--rf-text)' }}>{label}</span>
      <span style={{ fontFamily: REFINE_FONT.body, fontSize: 11.5, color: 'var(--rf-text-3)' }}>{sub}</span>
    </span>
  );
}

function ScreenOnboarding() {
  return (
    <PageBg>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 0 }}>
        <div style={{ padding: '54px 50px', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--rf-border)' }}>
          <Wordmark size={20} />
          <div style={{ marginTop: 'auto', marginBottom: 'auto', paddingTop: 40 }}>
            <Eyebrow>Step 2 of 3</Eyebrow>
            <h1 style={{ margin: '16px 0 18px', fontFamily: REFINE_FONT.display, fontSize: 40, fontWeight: 380, lineHeight: 1.14, letterSpacing: '-0.024em', maxWidth: 420 }}>
              Two ways in. Both are <em>writing</em>.
            </h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 400 }}>
              <div>
                <Eyebrow color="var(--rf-accent)" size={9.5} style={{ letterSpacing: '0.16em' }}>Open reflection</Eyebrow>
                <p style={{ margin: '7px 0 0', fontFamily: REFINE_FONT.display, fontSize: 16.5, lineHeight: 1.6, color: 'var(--rf-text-2)', textWrap: 'pretty' }}>A blank page. Refine offers a few footholds at the start — drawn from what you wrote before — then gets out of the way.</p>
              </div>
              <div>
                <Eyebrow color="var(--rf-accent)" size={9.5} style={{ letterSpacing: '0.16em' }}>Framework</Eyebrow>
                <p style={{ margin: '7px 0 0', fontFamily: REFINE_FONT.display, fontSize: 16.5, lineHeight: 1.6, color: 'var(--rf-text-2)', textWrap: 'pretty' }}>Established questionnaires and simple daily trackers, on a schedule you set. Scored, kept, charted. Never diagnosed.</p>
              </div>
            </div>
          </div>
          <p style={{ margin: 0, fontFamily: REFINE_FONT.body, fontSize: 12, color: 'var(--rf-text-4)', maxWidth: 380, lineHeight: 1.55 }}>Refine is not a therapist and not a chatbot. It reads what you write so it can ask better questions next time.</p>
        </div>
        <div style={{ padding: '54px 50px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Eyebrow>Choose what to keep track of</Eyebrow>
          <p style={{ margin: '10px 0 22px', fontFamily: REFINE_FONT.body, fontSize: 13, color: 'var(--rf-text-3)', maxWidth: 400, lineHeight: 1.6 }}>Pick as few as you like. You can change all of this later, and skipping a day costs nothing.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <PickChip label="Anxiety" sub="GAD-7 · fortnightly" on />
            <PickChip label="Low mood" sub="PHQ-9 · fortnightly" on />
            <PickChip label="Sleep" sub="Daily, one number" on />
            <PickChip label="Medication" sub="Daily, one tap" on />
            <PickChip label="Movement" sub="Daily, one tap" />
            <PickChip label="Alcohol" sub="Daily, one tap" />
          </div>
          <div style={{ marginTop: 26, display: 'flex', alignItems: 'center', gap: 18 }}>
            <Btn primary>Continue</Btn>
            <span style={{ fontFamily: REFINE_FONT.body, fontSize: 12.5, color: 'var(--rf-text-3)' }}>Skip — just let me write</span>
          </div>
        </div>
      </div>
    </PageBg>
  );
}

Object.assign(window, { ScreenMirror, ScreenOnboarding, MirrorTrends, MirrorThreads, ChartCard });
