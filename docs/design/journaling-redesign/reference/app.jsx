// Refine v3 — canvas. The product is now an AI-augmented journal: an entry is
// the unit of work, and Refine's guidance is a side rail, not a conversation.

const RF3_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "dawn",
  "dark": false,
  "footholdsOpen": true,
  "trackerOnHome": true,
  "mirrorTab": "trends"
}/*EDITMODE-END*/;

const FRAME_W = 1200, FRAME_H = 800, CONTENT_H = FRAME_H - 84;
const AW = FRAME_W + 20, AH = FRAME_H + 20;

function Desk({ palette, dark, title, url, children }) {
  return (
    <div style={{ padding: 10 }}>
      <ChromeWindow width={FRAME_W} height={FRAME_H} tabs={[{ title }]} url={`refine.app/${url}`}>
        <div style={{ width: FRAME_W, height: CONTENT_H }}>
          <ThemeFrame palette={palette} dark={dark}>{children}</ThemeFrame>
        </div>
      </ChromeWindow>
    </div>
  );
}

function Phone({ palette, dark, children }) {
  return (
    <div style={{ padding: 10, display: 'flex', justifyContent: 'center' }}>
      <IOSDevice width={402} height={874} dark={dark} title="Refine">
        <ThemeFrame palette={palette} dark={dark}>{children}</ThemeFrame>
      </IOSDevice>
    </div>
  );
}

// ── Foundation ──────────────────────────────────────────────────────────────

function Foundation({ palette, dark }) {
  const swatchRow = (c) => [c.bg, c.paper, c.surface, c.text, c.accent, c.accent2];
  return (
    <ThemeFrame palette={palette} dark={dark} style={{ display: 'flex', flexDirection: 'column', background: 'var(--rf-bg)', fontFamily: REFINE_FONT.body, color: 'var(--rf-text)' }}>
      <div style={{ padding: '38px 52px 0', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Wordmark size={25} />
        <Eyebrow>Design system · v3 · journaling-first · Jul 2026</Eyebrow>
      </div>
      <div style={{ padding: '26px 52px 40px', display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 56, flex: 1, minHeight: 0 }}>
        <div>
          <Eyebrow>What changed</Eyebrow>
          <h1 style={{ margin: '12px 0 16px', fontFamily: REFINE_FONT.display, fontSize: 42, fontWeight: 380, lineHeight: 1.08, letterSpacing: '-0.024em' }}>
            The entry is the work.<br />Refine only <em style={{ color: 'var(--rf-accent)' }}>frames</em> it.
          </h1>
          <p style={{ margin: '0 0 22px', fontFamily: REFINE_FONT.display, fontSize: 17, lineHeight: 1.65, color: 'var(--rf-text-2)', maxWidth: 470, textWrap: 'pretty' }}>
            Refine is an AI-augmented journal, not a conversation. Two ways in:
            an <strong style={{ fontWeight: 500 }}>open reflection</strong> with optional footholds drawn from
            earlier entries, or a <strong style={{ fontWeight: 500 }}>framework</strong> — an established
            questionnaire or a daily tracker. Both end up as entries. Mirror holds
            what they add up to.
          </p>
          <div style={{ padding: '18px 22px', borderRadius: 4, border: '1px solid var(--rf-border)', background: 'var(--rf-surface)' }}>
            <Eyebrow>How we get entries finished</Eyebrow>
            <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9, fontSize: 13, color: 'var(--rf-text-2)', lineHeight: 1.5 }}>
              <li><strong style={{ fontWeight: 500 }}>A bounded sheet.</strong> It looks fillable, never infinite.</li>
              <li><strong style={{ fontWeight: 500 }}>A descriptive norm, not a target.</strong> “Three or four sentences” beats a word count or a progress bar.</li>
              <li><strong style={{ fontWeight: 500 }}>Footholds in a rail.</strong> Offered once, at the start. Collapsible. Never inline, never mid-sentence.</li>
              <li><strong style={{ fontWeight: 500 }}>Finishing is one cheap button.</strong> “Set it down” — no judgement about length.</li>
              <li><strong style={{ fontWeight: 500 }}>Voice is an input.</strong> A pill beside the entry, not a mode you enter.</li>
            </ul>
          </div>
          <div style={{ marginTop: 20, display: 'flex', gap: 26, alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
              <MicPill />
              <Eyebrow size={9}>Idle</Eyebrow>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
              <MicPill recording />
              <Eyebrow size={9}>Capturing</Eyebrow>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
              <DictationDisc size={64} />
              <Eyebrow size={9}>Hands-free</Eyebrow>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, minHeight: 0 }}>
          <div>
            <Eyebrow>Type — unchanged</Eyebrow>
            <div style={{ marginTop: 12, padding: '18px 22px', borderRadius: 4, background: 'var(--rf-paper)', border: '1px solid var(--rf-paper-edge)', display: 'flex', flexDirection: 'column', gap: 13 }}>
              <div>
                <div style={{ fontFamily: REFINE_FONT.display, fontSize: 29, fontWeight: 400, lineHeight: 1.1, letterSpacing: '-0.018em' }}>Newsreader — <em>the entry itself</em></div>
                <Eyebrow size={9.5} style={{ letterSpacing: '0.1em' }}>Entry body 18.5/1.62 · display 27–42 · 380–400 wt</Eyebrow>
              </div>
              <Rule style={{ background: 'var(--rf-rule)' }} />
              <div>
                <div style={{ fontFamily: REFINE_FONT.body, fontSize: 15 }}>Geist — interface, buttons, guidance copy</div>
                <Eyebrow size={9.5} style={{ letterSpacing: '0.1em' }}>12–14.5px · 400–500 wt</Eyebrow>
              </div>
              <Rule style={{ background: 'var(--rf-rule)' }} />
              <div>
                <div style={{ fontFamily: REFINE_FONT.mono, fontSize: 11.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--rf-text-2)' }}>Geist Mono · eyebrows · dates · sources</div>
                <Eyebrow size={9.5} style={{ letterSpacing: '0.1em' }}>9–11px · 0.12–0.20em tracking</Eyebrow>
              </div>
            </div>
          </div>
          <div>
            <Eyebrow>Palette — re-explored toward paper</Eyebrow>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12 }}>
              {Object.entries(PALETTES).map(([key, p]) => (
                <div key={key} style={{ borderRadius: 4, border: '1px solid var(--rf-border)', overflow: 'hidden', background: 'var(--rf-paper)' }}>
                  <div style={{ height: 52, background: p.light.bgGradient }} />
                  <div style={{ padding: '12px 14px 14px' }}>
                    <h3 style={{ margin: 0, fontFamily: REFINE_FONT.display, fontSize: 17, fontWeight: 400, letterSpacing: '-0.01em' }}>{p.name}{key === 'dawn' && <span style={{ color: 'var(--rf-accent)', fontSize: 12 }}> · primary</span>}</h3>
                    <p style={{ margin: '4px 0 10px', fontSize: 11.5, lineHeight: 1.45, color: 'var(--rf-text-3)' }}>{p.tagline}</p>
                    {[p.light, p.dark].map((c, i) => (
                      <div key={i} style={{ display: 'flex', gap: 3, marginTop: 3 }}>
                        {swatchRow(c).map((sw, j) => <div key={j} style={{ flex: 1, height: 15, borderRadius: 2, background: sw, border: '0.5px solid rgba(0,0,0,.10)' }} />)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: '16px 20px', borderRadius: 4, border: '1px solid var(--rf-border)', background: 'var(--rf-surface)' }}>
            <Eyebrow>Still true</Eyebrow>
            <p style={{ margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.6, color: 'var(--rf-text-2)' }}>
              No bubbles, no avatars, no companion voice. No clinical styling even
              where the instrument is clinical. No streaks — the dot matrix is a
              record, not a reward. Refine is a tool with a voice, not a personality.
            </p>
          </div>
        </div>
      </div>
    </ThemeFrame>
  );
}

// ── Canvas ──────────────────────────────────────────────────────────────────

function RefineCanvasV3() {
  const [t, setTweak] = useTweaks(RF3_DEFAULTS);
  const P = { palette: t.palette, dark: t.dark };
  return (
    <React.Fragment>
      <DesignCanvas>
        <DCSection id="foundation" title="Foundation" subtitle="What the reframe changes, and the paper-leaning palette that follows from it.">
          <DCArtboard id="v3-brand" label="Foundation" width={1420} height={840}>
            <div style={{ padding: 10 }}>
              <div style={{ width: 1400, height: 820, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(0,0,0,.10)' }}>
                <Foundation palette={t.palette} dark={t.dark} />
              </div>
            </div>
          </DCArtboard>
        </DCSection>

        <DCSection id="entry" title="Writing an entry" subtitle="One continuous entry. Footholds live in a collapsible rail and are offered once, at the start.">
          <DCArtboard id="v3-write" label="Open reflection · footholds open" width={AW} height={AH}>
            <Desk {...P} title="Refine — today" url="entry/new">
              <ScreenWrite collapsed={!t.footholdsOpen} />
            </Desk>
          </DCArtboard>
          <DCArtboard id="v3-write-collapsed" label="Rail collapsed · nothing but the page" width={AW} height={AH}>
            <Desk {...P} title="Refine — today" url="entry/new">
              <ScreenWrite collapsed={t.footholdsOpen} />
            </Desk>
          </DCArtboard>
          <DCArtboard id="v3-write-empty" label="Empty state" width={AW} height={AH}>
            <Desk {...P} title="Refine — today" url="entry/new">
              <ScreenWrite collapsed={!t.footholdsOpen} empty />
            </Desk>
          </DCArtboard>
          <DCArtboard id="v3-voice" label="Dictating into the same entry" width={AW} height={AH}>
            <Desk {...P} title="Refine — today" url="entry/new">
              <ScreenVoice />
            </Desk>
          </DCArtboard>
          <DCArtboard id="v3-mobile" label="Mobile · writing" width={460} height={920}>
            <Phone {...P}><MobileWrite /></Phone>
          </DCArtboard>
          <DCArtboard id="v3-mobile-voice" label="Mobile · speaking" width={460} height={920}>
            <Phone {...P}><MobileWrite recording /></Phone>
          </DCArtboard>
        </DCSection>

        <DCSection id="framework" title="Framework mode & tracking" subtitle="A separate mode picked on Home. Instruments look like instruments — one tight page — without going clinical.">
          <DCArtboard id="v3-framework" label="GAD-7 · one scrollable page" width={AW} height={AH}>
            <Desk {...P} title="Refine — GAD-7" url="framework/gad7">
              <ScreenFramework />
            </Desk>
          </DCArtboard>
          <DCArtboard id="v3-checkin" label="Daily check-in · as its own ritual" width={AW} height={AH}>
            <Desk {...P} title="Refine — check in" url="checkin">
              <ScreenCheckin />
            </Desk>
          </DCArtboard>
          <DCArtboard id="v3-complete" label="Set down · session complete" width={AW} height={AH}>
            <Desk {...P} title="Refine — set down" url="entry/2f9/complete">
              <ScreenComplete />
            </Desk>
          </DCArtboard>
        </DCSection>

        <DCSection id="home" title="Home & archive" subtitle="Launchpad first, continuity second. The tracker strip is toggleable — the open question is Home strip vs. check-in ritual.">
          <DCArtboard id="v3-home" label={`Home · ${t.trackerOnHome ? 'with tracker strip' : 'no tracker strip'}`} width={AW} height={AH}>
            <Desk {...P} title="Refine" url="">
              <ScreenHome tracker={t.trackerOnHome} />
            </Desk>
          </DCArtboard>
          <DCArtboard id="v3-list" label="Entries · archive" width={AW} height={AH}>
            <Desk {...P} title="Refine — entries" url="entries">
              <ScreenList />
            </Desk>
          </DCArtboard>
          <DCArtboard id="v3-read" label="Single entry · read-back" width={AW} height={AH}>
            <Desk {...P} title="Refine — entry" url="entries/2f9">
              <ScreenRead />
            </Desk>
          </DCArtboard>
        </DCSection>

        <DCSection id="mirror" title="Mirror" subtitle="Now holds tracker and questionnaire history as structured data, alongside facts and threads.">
          <DCArtboard id="v3-mirror-trends" label="Mirror · trends · instruments" width={AW} height={AH}>
            <Desk {...P} title="Refine — mirror" url="mirror/trends">
              <ScreenMirror tab="trends" />
            </Desk>
          </DCArtboard>
          <DCArtboard id="v3-mirror-habits" label="Mirror · trends · scrolled to habits" width={AW} height={AH}>
            <Desk {...P} title="Refine — mirror" url="mirror/trends">
              <ScreenMirror tab="trends" part={2} />
            </Desk>
          </DCArtboard>
          <DCArtboard id="v3-mirror-threads" label="Mirror · threads & facts" width={AW} height={AH}>
            <Desk {...P} title="Refine — mirror" url="mirror/threads">
              <ScreenMirror tab="threads" />
            </Desk>
          </DCArtboard>
        </DCSection>

        <DCSection id="onboarding" title="Onboarding" subtitle="Teach the two modes, then let them choose what gets tracked.">
          <DCArtboard id="v3-onboarding" label="Onboarding · step 2" width={AW} height={AH}>
            <Desk {...P} title="Refine — welcome" url="welcome">
              <ScreenOnboarding />
            </Desk>
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel>
        <TweakSection label="Palette" />
        <TweakRadio label="Direction" value={t.palette} options={['dawn', 'dusk', 'slate']} onChange={(v) => setTweak('palette', v)} />
        <TweakRadio label="Mode" value={t.dark ? 'dark' : 'light'} options={['light', 'dark']} onChange={(v) => setTweak('dark', v === 'dark')} />
        <TweakSection label="Entry screen" />
        <TweakToggle label="Footholds open by default" value={t.footholdsOpen} onChange={(v) => setTweak('footholdsOpen', v)} />
        <TweakSection label="Open question" />
        <TweakToggle label="Tracker strip on Home" value={t.trackerOnHome} onChange={(v) => setTweak('trackerOnHome', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<RefineCanvasV3 />);
