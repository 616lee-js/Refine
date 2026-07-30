// Refine v3 — Home (launchpad + continuity), entry archive, entry read-back.

function LaunchCard({ eyebrow, title, body, cta, secondary, accentEyebrow }) {
  return (
    <Sheet style={{ padding: '20px 22px 18px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 168 }}>
      <Eyebrow color={accentEyebrow ? 'var(--rf-accent)' : 'var(--rf-text-3)'}>{eyebrow}</Eyebrow>
      <h3 style={{ margin: 0, fontFamily: REFINE_FONT.display, fontSize: 22, fontWeight: 380, letterSpacing: '-0.014em', lineHeight: 1.2, color: 'var(--rf-text)' }}>{title}</h3>
      <p style={{ margin: 0, fontFamily: REFINE_FONT.body, fontSize: 12.5, lineHeight: 1.55, color: 'var(--rf-text-3)', textWrap: 'pretty' }}>{body}</p>
      <div style={{ marginTop: 'auto', paddingTop: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
        <Btn primary size="sm">{cta}</Btn>
        {secondary}
      </div>
    </Sheet>
  );
}

// The tracker strip. Placement is still open (Home vs. check-in ritual) — the
// canvas shows both; this is the Home version.
function TrackerStrip() {
  return (
    <div style={{ padding: '15px 20px', border: '1px solid var(--rf-border)', borderRadius: 4, background: 'var(--rf-surface)', display: 'flex', alignItems: 'center', gap: 26 }}>
      <div style={{ flexShrink: 0 }}>
        <Eyebrow>Check-in</Eyebrow>
        <p style={{ margin: '5px 0 0', fontFamily: REFINE_FONT.body, fontSize: 11.5, color: 'var(--rf-text-4)' }}>15 seconds</p>
      </div>
      <div style={{ width: 1, height: 34, background: 'var(--rf-border)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Eyebrow size={9.5} style={{ letterSpacing: '0.14em' }}>Slept</Eyebrow>
          <span style={{ fontFamily: REFINE_FONT.display, fontSize: 19, color: 'var(--rf-text)' }}>5.5</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Eyebrow size={9.5} style={{ letterSpacing: '0.14em' }}>Mood</Eyebrow>
          <div style={{ display: 'flex', gap: 4 }}>
            {[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ width: 20, height: 20, borderRadius: 3, display: 'grid', placeItems: 'center', background: i === 2 ? 'var(--rf-accent)' : 'transparent', boxShadow: i === 2 ? 'none' : 'inset 0 0 0 1px var(--rf-border)', fontFamily: REFINE_FONT.mono, fontSize: 9.5, color: i === 2 ? 'var(--rf-paper)' : 'var(--rf-text-4)' }}>{i + 1}</span>)}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Eyebrow size={9.5} style={{ letterSpacing: '0.14em' }}>Kept up</Eyebrow>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['Meds', true], ['Moved', true], ['Outside', false]].map(([l, on], i) => (
              <span key={i} style={{ padding: '4px 10px', borderRadius: 999, fontFamily: REFINE_FONT.body, fontSize: 11.5, color: on ? 'var(--rf-text)' : 'var(--rf-text-3)', background: on ? 'var(--rf-accent-2-soft)' : 'transparent', boxShadow: on ? 'inset 0 0 0 1px var(--rf-accent-2)' : 'inset 0 0 0 1px var(--rf-border)' }}>{l}</span>
            ))}
          </div>
        </div>
      </div>
      <Btn size="sm" style={{ flexShrink: 0 }}>Log</Btn>
    </div>
  );
}

const RECENT = [
  ['28 Jul', 'On not wanting the promotion', 'Open', 'voice'],
  ['26 Jul', 'The tiredness, or the wanting', 'Open', 'text'],
  ['25 Jul', 'GAD-7 · recorded', 'Framework', null],
  ['24 Jul', 'A good call with Dad', 'Open', 'text'],
];

function RecentRow({ date, title, kind, mode }) {
  return (
    <div style={{ padding: '11px 0', borderTop: '1px solid var(--rf-rule)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <span style={{ fontFamily: REFINE_FONT.mono, fontSize: 10, letterSpacing: '0.08em', color: 'var(--rf-text-4)', width: 44, flexShrink: 0, paddingTop: 3 }}>{date}</span>
      <span style={{ fontFamily: REFINE_FONT.display, fontSize: 15, lineHeight: 1.4, color: kind === 'Framework' ? 'var(--rf-text-2)' : 'var(--rf-text)', flex: 1, textWrap: 'pretty' }}>{title}</span>
      {mode === 'voice' && <span style={{ flexShrink: 0, paddingTop: 3, opacity: .6 }}><MicIcon size={10} stroke="var(--rf-text-3)" width={1.6} /></span>}
    </div>
  );
}

function ScreenHome({ tracker = true }) {
  return (
    <PageBg>
      <TopNav active="today" />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 312px', gap: 46, padding: '34px 46px 0', minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26, minWidth: 0 }}>
          <div>
            <Eyebrow>Tuesday 28 July · morning</Eyebrow>
            <p style={{ margin: '14px 0 0', fontFamily: REFINE_FONT.display, fontSize: 27, lineHeight: 1.34, fontWeight: 380, letterSpacing: '-0.016em', color: 'var(--rf-text)', maxWidth: 560, textWrap: 'pretty' }}>
              You left off wondering whether the tiredness was <em>the work</em> or <em>the wanting</em>.
            </p>
            <p style={{ margin: '12px 0 0', fontFamily: REFINE_FONT.body, fontSize: 12.5, color: 'var(--rf-text-3)' }}>
              From Sunday’s entry. <span style={{ borderBottom: '1px solid var(--rf-border-strong)', color: 'var(--rf-text-2)' }}>Read it back</span>
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <LaunchCard
              accentEyebrow
              eyebrow="Open reflection"
              title="Write what’s there"
              body="Nothing to answer. Three footholds waiting in the margin if you want a way in."
              cta="Begin"
              secondary={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: REFINE_FONT.body, fontSize: 12.5, color: 'var(--rf-text-3)' }}><MicIcon size={12} stroke="var(--rf-accent)" />or speak it</span>}
            />
            <LaunchCard
              eyebrow="Framework"
              title="GAD-7 · due today"
              body="Two weeks since the last one. Seven questions, then back to your own words."
              cta="Start"
              secondary={<span style={{ fontFamily: REFINE_FONT.body, fontSize: 12.5, color: 'var(--rf-text-3)', borderBottom: '1px solid var(--rf-border)' }}>Choose another</span>}
            />
          </div>
          {tracker && <TrackerStrip />}
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 24, borderLeft: '1px solid var(--rf-border)', paddingLeft: 30, minWidth: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Eyebrow>Recent</Eyebrow>
              <Eyebrow size={9.5} style={{ letterSpacing: '0.14em' }}>All 148</Eyebrow>
            </div>
            <div style={{ marginTop: 10 }}>{RECENT.map((r, i) => <RecentRow key={i} date={r[0]} title={r[1]} kind={r[2]} mode={r[3]} />)}</div>
          </div>
          <div style={{ paddingTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Eyebrow>Mirror</Eyebrow>
              <Eyebrow size={9.5} style={{ letterSpacing: '0.14em' }}>3 to confirm</Eyebrow>
            </div>
            <p style={{ margin: '12px 0 4px', fontFamily: REFINE_FONT.display, fontSize: 14.5, lineHeight: 1.5, color: 'var(--rf-text-2)', textWrap: 'pretty' }}>
              Anxiety has run higher on weeks with under six hours of sleep.
            </p>
            <div style={{ marginTop: 10 }}>
              <LineChart data={[6, 8, 7, 11, 10, 13, 12]} w={250} h={78} max={21} labels={['', '', '', '', '', '', 'now']} />
            </div>
            <p style={{ margin: '8px 0 0', fontFamily: REFINE_FONT.mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--rf-text-4)' }}>GAD-7 · seven readings</p>
          </div>
        </aside>
      </div>
    </PageBg>
  );
}

// ── Archive ─────────────────────────────────────────────────────────────────

const ARCHIVE = [
  ['Jul', '28', 'On not wanting the promotion', 'Open', 'voice', 'Slept badly again and the whole morning had that thin quality to it…'],
  ['Jul', '28', 'Check-in · 5.5h, mood 3', 'Check-in', null, 'Meds · Moved'],
  ['Jul', '26', 'The tiredness, or the wanting', 'Open', 'text', 'I don’t know if I’m tired of the job or tired of pretending the job is the thing…'],
  ['Jul', '25', 'GAD-7 · 12', 'Framework', null, 'Up from 8 on 11 Jul. Note: restlessness mostly evenings.'],
  ['Jul', '24', 'A good call with Dad', 'Open', 'voice', 'He asked about the flat and I didn’t get defensive, which is new…'],
  ['Jul', '22', 'Nothing much, honestly', 'Open', 'text', 'A flat day. Writing it down anyway because that was the deal…'],
];

function ArchiveRow({ mon, day, title, kind, mode, excerpt, first }) {
  const isEntry = kind === 'Open';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 96px', gap: 22, alignItems: 'baseline', padding: '14px 0', borderTop: first ? 'none' : '1px solid var(--rf-rule)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span style={{ fontFamily: REFINE_FONT.display, fontSize: 20, color: 'var(--rf-text-2)' }}>{day}</span>
        <span style={{ fontFamily: REFINE_FONT.mono, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--rf-text-4)' }}>{mon}</span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontFamily: REFINE_FONT.display, fontSize: 17.5, color: isEntry ? 'var(--rf-text)' : 'var(--rf-text-2)', letterSpacing: '-0.01em' }}>{title}</span>
          {mode === 'voice' && <span style={{ opacity: .55 }}><MicIcon size={10} stroke="var(--rf-text-3)" width={1.6} /></span>}
        </div>
        <p style={{ margin: '5px 0 0', fontFamily: REFINE_FONT.body, fontSize: 12.5, lineHeight: 1.5, color: 'var(--rf-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{excerpt}</p>
      </div>
      <div style={{ textAlign: 'right' }}><Chip soft={kind === 'Framework'} accent={kind === 'Framework'}>{kind}</Chip></div>
    </div>
  );
}

function ScreenList() {
  return (
    <PageBg>
      <TopNav active="entries" />
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '32px 40px 0', minHeight: 0 }}>
        <div style={{ width: '100%', maxWidth: 780 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 16 }}>
            <div>
              <Eyebrow>148 entries · since March</Eyebrow>
              <h1 style={{ margin: '10px 0 0', fontFamily: REFINE_FONT.display, fontSize: 30, fontWeight: 380, letterSpacing: '-0.02em' }}>Everything you’ve set down</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {['All', 'Open', 'Framework', 'Check-ins'].map((f, i) => (
                <span key={f} style={{ padding: '6px 13px', borderRadius: 999, fontFamily: REFINE_FONT.body, fontSize: 12.5, color: i === 0 ? 'var(--rf-paper)' : 'var(--rf-text-3)', background: i === 0 ? 'var(--rf-text)' : 'transparent', boxShadow: i === 0 ? 'none' : 'inset 0 0 0 1px var(--rf-border)' }}>{f}</span>
              ))}
            </div>
          </div>
          <Sheet style={{ padding: '8px 28px 20px' }}>
            {ARCHIVE.map((r, i) => <ArchiveRow key={i} first={i === 0} mon={r[0]} day={r[1]} title={r[2]} kind={r[3]} mode={r[4]} excerpt={r[5]} />)}
          </Sheet>
          <p style={{ margin: '16px 0 0', textAlign: 'center', fontFamily: REFINE_FONT.mono, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--rf-text-4)' }}>Earlier in July</p>
        </div>
      </div>
    </PageBg>
  );
}

// ── Read-back ───────────────────────────────────────────────────────────────

function ScreenRead() {
  return (
    <PageBg>
      <TopNav active="entries" />
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '32px 40px 0', minHeight: 0 }}>
        <div style={{ width: '100%', maxWidth: 640 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16 }}>
            <Eyebrow size={9.5} style={{ letterSpacing: '0.16em' }}>← Entries</Eyebrow>
            <div style={{ display: 'flex', gap: 14 }}>
              <Eyebrow size={9.5} style={{ letterSpacing: '0.16em' }}>Prev</Eyebrow>
              <Eyebrow size={9.5} color="var(--rf-accent)" style={{ letterSpacing: '0.16em' }}>Next</Eyebrow>
            </div>
          </div>
          <Sheet style={{ padding: '30px 38px 26px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid var(--rf-rule)' }}>
              <Eyebrow color="var(--rf-accent)">Open reflection · dictated</Eyebrow>
              <Eyebrow size={9.5} style={{ letterSpacing: '0.1em' }}>Tue 28 Jul · 9:12–9:19</Eyebrow>
            </div>
            <h1 style={{ margin: '20px 0 4px', fontFamily: REFINE_FONT.display, fontSize: 28, fontWeight: 380, lineHeight: 1.18, letterSpacing: '-0.02em' }}>On not wanting <em>the promotion</em></h1>
            <p style={{ margin: '0 0 22px', fontFamily: REFINE_FONT.mono, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--rf-text-4)' }}>Started cold · no foothold used</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <EntryParagraph>{ENTRY_TEXT[0]}</EntryParagraph>
              <EntryParagraph>{ENTRY_TEXT[1]}</EntryParagraph>
              <EntryParagraph>And I think if I say that out loud to anyone it becomes real, so I’ve been keeping it here instead. Which is fine. That’s what here is for.</EntryParagraph>
            </div>
            <div style={{ marginTop: 26, paddingTop: 16, borderTop: '1px solid var(--rf-rule)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Eyebrow size={9.5} style={{ letterSpacing: '0.16em', marginRight: 4 }}>Kept in Mirror</Eyebrow>
              <Chip soft accent>Fact · promotion</Chip>
              <Chip soft accent>Thread · sleep</Chip>
              <Chip>Pattern · deflection</Chip>
            </div>
          </Sheet>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 0' }}>
            <span style={{ fontFamily: REFINE_FONT.body, fontSize: 12.5, color: 'var(--rf-text-3)' }}>Play the recording · 7:02</span>
            <div style={{ display: 'flex', gap: 12 }}>
              <Btn ghost size="sm">Delete</Btn>
              <Btn size="sm">Add to this entry</Btn>
            </div>
          </div>
        </div>
      </div>
    </PageBg>
  );
}

Object.assign(window, { ScreenHome, ScreenList, ScreenRead, TrackerStrip, LaunchCard });
