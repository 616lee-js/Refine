// v3.1 atoms — mirrors the repo's components (src/components/ui/*) so the
// refreshed ones are designed against what actually ships.

const F = { display: '"Newsreader", Georgia, serif', sans: '"Geist", system-ui, sans-serif', mono: '"Geist Mono", ui-monospace, monospace' };
// One page gutter everywhere: nav, rail and main align to the same left edge.
const GUTTER = 20;
const monoCaps = (size = 9.5, ls = '0.14em') => ({ fontFamily: F.mono, fontSize: size, letterSpacing: ls, textTransform: 'uppercase' });

function RfEyebrow({ children, accent, size = 10, style }) {
  return <span style={{ ...monoCaps(size, '0.18em'), fontWeight: 500, color: accent ? 'var(--rf-accent)' : 'var(--rf-text-3)', ...style }}>{children}</span>;
}

function RfWordmark({ size = 19 }) {
  return <span style={{ fontFamily: F.display, fontSize: size, fontWeight: 400, letterSpacing: '-0.01em', color: 'var(--rf-text)' }}>Refine<span style={{ color: 'var(--rf-accent)' }}>.</span></span>;
}

function RfSheet({ children, style }) {
  return <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--rf-paper)', border: '1px solid var(--rf-paper-edge)', borderRadius: 3, boxShadow: 'var(--rf-sheet-shadow)', ...style }}>{children}</div>;
}

function RfPageBg({ children }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: 'var(--rf-bg-gradient)', backgroundColor: 'var(--rf-bg)', fontFamily: F.sans, color: 'var(--rf-text)' }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundImage: 'var(--rf-grain-image)', opacity: 'var(--rf-grain-opacity)', mixBlendMode: 'multiply', pointerEvents: 'none' }}></div>
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  );
}

function RfTopNav({ active }) {
  const item = (k, label) => {
    const on = active === k;
    return <a key={k} href="#" style={{ fontSize: 13.5, fontWeight: on ? 500 : 400, color: on ? 'var(--rf-text)' : 'var(--rf-text-3)', paddingBottom: 2, borderBottom: on ? '1px solid var(--rf-accent)' : '1px solid transparent', textDecoration: 'none' }}>{label}</a>;
  };
  return (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, padding: `16px ${GUTTER}px`, borderBottom: '1px solid var(--rf-border)', flexShrink: 0 }}>
      <RfWordmark />
      <nav style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        {item('reflections', 'Reflections')}{item('mirror', 'Mirror')}{item('profile', 'Profile')}
        <span style={{ fontSize: 13.5, color: 'var(--rf-text-3)' }}>Sign out</span>
      </nav>
    </header>
  );
}

function RfPageHead({ eyebrow, title, lede, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, paddingBottom: 18 }}>
      <div>
        <RfEyebrow>{eyebrow}</RfEyebrow>
        <h1 style={{ margin: '9px 0 8px', fontFamily: F.display, fontSize: 30, fontWeight: 380, letterSpacing: '-0.02em', color: 'var(--rf-text)' }}>{title}</h1>
        {lede && <p style={{ margin: 0, maxWidth: 460, fontSize: 13, lineHeight: 1.6, color: 'var(--rf-text-3)' }}>{lede}</p>}
      </div>
      {right}
    </div>
  );
}

// Buttons: ink pill (primary), outlined pill, mono text action.
function RfBtn({ children, variant = 'primary', size = 'md', full, style }) {
  const pad = size === 'sm' ? { padding: '7px 15px', fontSize: 12.5 } : { padding: '9px 18px', fontSize: 13.5 };
  if (variant === 'text') return <button style={{ ...monoCaps(9.5), background: 'none', border: 'none', padding: 0, color: 'var(--rf-text-3)', ...style }}>{children}</button>;
  const v = variant === 'primary'
    ? { background: 'var(--rf-text)', color: 'var(--rf-paper)', boxShadow: 'none' }
    : { background: 'transparent', color: 'var(--rf-text-2)', boxShadow: 'inset 0 0 0 1px var(--rf-border-strong)' };
  return <button style={{ ...pad, ...v, fontFamily: F.sans, fontWeight: 500, border: 'none', borderRadius: 999, width: full ? '100%' : undefined, ...style }}>{children}</button>;
}

// Text fields: recessed surface, inset hairline, 4px. Focus = accent hairline.
function RfInput({ id, label, note, placeholder, value, type = 'text', focus, mono, rows }) {
  const box = { width: '100%', boxSizing: 'border-box', borderRadius: 4, padding: rows ? '12px 16px' : '10px 14px', fontFamily: mono ? F.mono : F.sans, fontSize: mono ? 13 : 14, letterSpacing: mono ? '0.08em' : 0, textTransform: mono ? 'uppercase' : 'none', lineHeight: 1.6, color: 'var(--rf-text)', background: focus ? 'var(--rf-paper)' : 'var(--rf-surface)', boxShadow: focus ? 'inset 0 0 0 1px var(--rf-accent)' : 'inset 0 0 0 1px var(--rf-border)', border: 'none', outline: 'none', resize: 'none' };
  return (
    <label htmlFor={id} style={{ display: 'flex', flexDirection: 'column' }}>
      {label && <span style={{ fontSize: rows ? 14 : 12.5, color: rows ? 'var(--rf-text)' : 'var(--rf-text-2)', marginBottom: note ? 3 : 6 }}>{label}</span>}
      {note && <span style={{ fontSize: 11.5, color: 'var(--rf-text-4)', marginBottom: 9 }}>{note}</span>}
      {rows ? <textarea id={id} rows={rows} defaultValue={value} placeholder={placeholder} style={box}></textarea> : <input id={id} type={type} defaultValue={value} placeholder={placeholder} style={box} />}
    </label>
  );
}

// NEW — block notice. Replaces ad-hoc rgba error boxes and text-red-600.
function RfNotice({ tone = 'error', children, style }) {
  const t = { error: ['var(--rf-error)', 'var(--rf-error-soft)'], warn: ['var(--rf-warn)', 'var(--rf-warn-soft)'], quiet: ['var(--rf-text-2)', 'var(--rf-surface)'] }[tone];
  return <p role={tone === 'error' ? 'alert' : 'status'} style={{ margin: 0, borderRadius: 4, padding: '9px 13px', fontSize: 12.5, lineHeight: 1.55, color: t[0], background: t[1], boxShadow: tone === 'quiet' ? 'inset 0 0 0 1px var(--rf-border)' : 'none', ...style }}>{children}</p>;
}

// Inline success pill (repo: completion-notice.tsx) — unchanged, shown for reference.
function RfDone({ children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px 6px 10px', borderRadius: 999, fontSize: 12.5, color: 'var(--rf-accent-2)', background: 'var(--rf-accent-2-soft)' }}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.5 L5 9 L9.5 3.5"></path></svg>{children}
    </span>
  );
}

// REFRESHED — toast. Ink pill on paper; was rounded-xl bg-stone-800 text-white.
function RfToast({ children, style }) {
  return <div role="status" style={{ display: 'inline-flex', alignItems: 'center', padding: '9px 16px', borderRadius: 999, fontSize: 13, color: 'var(--rf-paper)', background: 'var(--rf-text)', boxShadow: 'var(--rf-sheet-shadow)', ...style }}>{children}</div>;
}

// REFRESHED — badge. Mono pill; product variants on tokens, tier variants stay admin-only.
function RfBadge({ variant = 'neutral', children }) {
  const v = {
    active: { color: 'var(--rf-accent-2)', background: 'var(--rf-accent-2-soft)' },
    ended: { color: 'var(--rf-text-3)', background: 'var(--rf-surface)', boxShadow: 'inset 0 0 0 1px var(--rf-border)' },
    accent: { color: 'var(--rf-accent)', background: 'var(--rf-accent-soft)' },
    neutral: { color: 'var(--rf-text-3)', background: 'transparent', boxShadow: 'inset 0 0 0 1px var(--rf-border)' },
  }[variant];
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, ...monoCaps(9), ...v }}>{children}</span>;
}

function RfChip({ on, children }) {
  return <span style={{ padding: '4px 9px', fontSize: 10.5, borderRadius: 999, color: on ? 'var(--rf-paper)' : 'var(--rf-text-3)', background: on ? 'var(--rf-text)' : 'transparent', boxShadow: on ? 'none' : 'inset 0 0 0 1px var(--rf-border)' }}>{children}</span>;
}

function RfRecordCard({ kind, date, detail, selected, accent, status }) {
  return (
    <RfSheet style={{ padding: '13px 15px', ...(selected ? { background: 'var(--rf-accent-soft)', boxShadow: 'inset 0 0 0 1px var(--rf-accent)' } : {}) }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontFamily: F.mono, fontSize: 14, letterSpacing: '0.08em', fontWeight: 500, textTransform: 'uppercase', color: accent ? 'var(--rf-accent)' : 'var(--rf-text-3)' }}>{kind}</span>
        <span style={{ fontFamily: F.display, fontSize: 14, color: 'var(--rf-text-2)' }}>{date}</span>
      </div>
      {detail && <p style={{ margin: '5px 0 0', fontSize: 12, lineHeight: 1.5, color: 'var(--rf-text-2)' }}>{detail}</p>}
      {status && <div style={{ marginTop: 6 }}><RfEyebrow size={9}>{status}</RfEyebrow></div>}
    </RfSheet>
  );
}

// NEW — palette picker (Profile → Preferences). A radio group; each option is
// previewed in its own palette, the selection ring is drawn in the current one.
function PalettePicker({ value, onChange, dark }) {
  return (
    <div role="radiogroup" aria-label="Palette" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
      {['dawn', 'dusk', 'slate'].map((k) => {
        const on = value === k;
        return (
          <button key={k} role="radio" aria-checked={on} onClick={() => onChange && onChange(k)} style={{ padding: 0, textAlign: 'left', border: 'none', borderRadius: 4, overflow: 'hidden', cursor: 'pointer', background: 'var(--rf-paper)', boxShadow: on ? '0 0 0 1px var(--rf-accent), inset 0 0 0 1px var(--rf-accent)' : 'inset 0 0 0 1px var(--rf-border)' }}>
            <PaletteFrame palette={k} dark={dark} style={{ height: 84 }}>
              <div style={{ height: '100%', padding: '14px 14px 0', background: 'var(--rf-bg-gradient)', backgroundColor: 'var(--rf-bg)', boxSizing: 'border-box' }}>
                <div style={{ height: '100%', boxSizing: 'border-box', padding: '10px 12px', background: 'var(--rf-paper)', border: '1px solid var(--rf-paper-edge)', borderBottom: 'none', borderRadius: '3px 3px 0 0', boxShadow: 'var(--rf-sheet-shadow)', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <RfWordmark size={14} />
                  <span style={{ height: 1, background: 'var(--rf-rule)' }}></span>
                  <span style={{ display: 'flex', gap: 5 }}>
                    <span style={{ width: 22, height: 5, borderRadius: 9, background: 'var(--rf-accent)' }}></span>
                    <span style={{ width: 14, height: 5, borderRadius: 9, background: 'var(--rf-accent-2)' }}></span>
                    <span style={{ width: 30, height: 5, borderRadius: 9, background: 'var(--rf-text-4)', opacity: 0.6 }}></span>
                  </span>
                </div>
              </div>
            </PaletteFrame>
            <div style={{ padding: '10px 12px 12px', borderTop: '1px solid var(--rf-border)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontFamily: F.display, fontSize: 16, color: 'var(--rf-text)' }}>{PALETTES[k].name}</span>
                {on && <RfEyebrow accent size={8.5}>In use</RfEyebrow>}
              </div>
              <p style={{ margin: '3px 0 0', fontSize: 11.5, lineHeight: 1.45, color: 'var(--rf-text-3)' }}>{PALETTE_EXTRA[k].label}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// NEW — appearance control. Segmented, same chip language as the rail's type filter.
function ModeControl({ value, onChange }) {
  const opts = [['light', 'Light'], ['dark', 'Dark'], ['system', 'Match device']];
  return (
    <div role="radiogroup" aria-label="Appearance" style={{ display: 'inline-flex', padding: 3, gap: 2, borderRadius: 999, background: 'var(--rf-surface)', boxShadow: 'inset 0 0 0 1px var(--rf-border)' }}>
      {opts.map(([k, label]) => {
        const on = value === k;
        return <button key={k} role="radio" aria-checked={on} onClick={() => onChange && onChange(k)} style={{ border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: on ? 500 : 400, color: on ? 'var(--rf-paper)' : 'var(--rf-text-3)', background: on ? 'var(--rf-text)' : 'transparent' }}>{label}</button>;
      })}
    </div>
  );
}

Object.assign(window, { GUTTER, ModeControl, F, monoCaps, RfEyebrow, RfWordmark, RfSheet, RfPageBg, RfTopNav, RfPageHead, RfBtn, RfInput, RfNotice, RfDone, RfToast, RfBadge, RfChip, RfRecordCard, PalettePicker });
