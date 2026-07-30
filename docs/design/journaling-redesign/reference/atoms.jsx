// Refine v3 — atoms. Journaling-first: voice is an INPUT, not a mode, so the
// big centrepiece orb is gone. What replaces it: a mic pill that lives with
// the entry, and a compact dictation disc for the hands-free state.

if (typeof document !== 'undefined' && !document.getElementById('rf3-anim')) {
  const s = document.createElement('style');
  s.id = 'rf3-anim';
  s.textContent = `
    @keyframes rf3-bar { 0%,100% { transform: scaleY(.35) } 50% { transform: scaleY(1) } }
    @keyframes rf3-breath { 0%,100% { transform: scale(1); opacity:.9 } 50% { transform: scale(1.035); opacity:1 } }
    @keyframes rf3-caret { 0%,45% { opacity:1 } 55%,100% { opacity:0 } }
    .rf3-caret { display:inline-block; width:1.5px; height:1em; background:var(--rf-accent); vertical-align:-0.14em; margin-left:2px; animation: rf3-caret 1.1s step-end infinite; }
  `;
  document.head.appendChild(s);
}

function Eyebrow({ children, color, size = 10.5, style }) {
  return <span style={{ fontFamily: REFINE_FONT.mono, fontSize: size, letterSpacing: '0.18em', textTransform: 'uppercase', color: color || 'var(--rf-text-3)', fontWeight: 500, ...style }}>{children}</span>;
}

function Wordmark({ size = 20 }) {
  return (
    <span style={{ fontFamily: REFINE_FONT.display, fontSize: size, fontWeight: 380, letterSpacing: '-0.018em', color: 'var(--rf-text)', lineHeight: 1, display: 'inline-flex', alignItems: 'baseline' }}>
      Refine<span style={{ color: 'var(--rf-accent)' }}>.</span>
    </span>
  );
}

function Rule({ style }) {
  return <div style={{ height: 1, background: 'var(--rf-border)', ...style }} />;
}

function Btn({ children, primary, ghost, size = 'md', style, full, accent }) {
  const base = { fontFamily: REFINE_FONT.body, fontWeight: 500, borderRadius: 999, border: 'none', cursor: 'default', display: 'inline-flex', alignItems: 'center', gap: 8, width: full ? '100%' : undefined, justifyContent: full ? 'center' : undefined };
  const sizes = { sm: { fontSize: 12.5, padding: '7px 15px' }, md: { fontSize: 13.5, padding: '11px 22px' }, lg: { fontSize: 14.5, padding: '14px 30px' } };
  if (primary) return <button style={{ ...base, ...sizes[size], background: accent ? 'var(--rf-accent)' : 'var(--rf-text)', color: 'var(--rf-paper)', ...style }}>{children}</button>;
  if (ghost) return <button style={{ ...base, ...sizes[size], background: 'transparent', color: 'var(--rf-text-3)', ...style }}>{children}</button>;
  return <button style={{ ...base, ...sizes[size], background: 'transparent', color: 'var(--rf-text-2)', boxShadow: 'inset 0 0 0 1px var(--rf-border-strong)', ...style }}>{children}</button>;
}

function Field({ label, placeholder, type = 'text', value, hint }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {label && <Eyebrow style={{ letterSpacing: '0.14em' }}>{label}{hint && <span style={{ marginLeft: 8, textTransform: 'none', letterSpacing: '0.02em', color: 'var(--rf-text-4)' }}>{hint}</span>}</Eyebrow>}
      <input defaultValue={value} placeholder={placeholder} type={type} style={{ fontFamily: REFINE_FONT.body, fontSize: 14.5, color: 'var(--rf-text)', background: 'var(--rf-paper)', border: '1px solid var(--rf-border)', borderRadius: 999, padding: '12px 18px', outline: 'none' }} />
    </label>
  );
}

function PageBg({ children, grain = true, style }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: 'var(--rf-bg-gradient, var(--rf-bg))', ...style }}>
      {grain && <div style={{ position: 'absolute', inset: 0, opacity: 'var(--rf-grain-opacity,.4)', backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.55  0 0 0 0 0.45  0 0 0 0 0.3  0 0 0 0.18 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`, mixBlendMode: 'multiply', pointerEvents: 'none', zIndex: 0 }} />}
      <div style={{ position: 'relative', height: '100%', zIndex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  );
}

function TopNav({ active = 'today', right, compact }) {
  const items = [['today', 'Today'], ['entries', 'Entries'], ['mirror', 'Mirror']];
  return (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: compact ? '14px 26px' : '18px 34px', borderBottom: '1px solid var(--rf-border)', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
        <Wordmark size={compact ? 17 : 19} />
        <nav style={{ display: 'flex', gap: 22 }}>
          {items.map(([k, label]) => (
            <a key={k} href="#" style={{ fontFamily: REFINE_FONT.body, fontSize: 13, textDecoration: 'none', color: active === k ? 'var(--rf-text)' : 'var(--rf-text-3)', fontWeight: active === k ? 500 : 400, borderBottom: active === k ? '1px solid var(--rf-accent)' : '1px solid transparent', paddingBottom: 3 }}>{label}</a>
          ))}
        </nav>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {right}
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--rf-accent-soft)', border: '1px solid var(--rf-border)', display: 'grid', placeItems: 'center', fontFamily: REFINE_FONT.mono, fontSize: 10, color: 'var(--rf-accent)' }}>N</div>
      </div>
    </header>
  );
}

// ── Voice as input ──────────────────────────────────────────────────────────

function Waveform({ bars = 22, height = 18, gap = 2.5, w = 2.5, color, active = true, opacity = 1 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap, height, opacity }}>
      {Array.from({ length: bars }).map((_, i) => {
        const h = 4 + Math.abs(Math.sin(i * 0.7 + 0.4)) * (height - 4);
        return <span key={i} style={{ width: w, height: h, borderRadius: 99, background: color || 'var(--rf-accent)', transformOrigin: 'center', animation: active ? `rf3-bar ${0.9 + (i % 5) * 0.14}s ${i * 0.05}s ease-in-out infinite` : 'none' }} />;
      })}
    </span>
  );
}

function MicIcon({ size = 15, stroke = 'currentColor', width = 1.5 }) {
  return (
    <svg width={size} height={size * 1.32} viewBox="0 0 24 32" fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" style={{ display: 'block' }}>
      <rect x="8.5" y="1.5" width="7" height="16" rx="3.5" />
      <path d="M4.5 14 v1.5 a7.5 7.5 0 0 0 15 0 V14" />
      <line x1="12" y1="23" x2="12" y2="29" />
    </svg>
  );
}

// The pill that sits with the entry. Voice is just another way in.
function MicPill({ recording, elapsed = '0:42', label = 'Speak instead' }) {
  if (!recording) {
    return (
      <button style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '9px 16px 9px 13px', borderRadius: 999, background: 'var(--rf-paper)', border: '1px solid var(--rf-border-strong)', color: 'var(--rf-text-2)', fontFamily: REFINE_FONT.body, fontSize: 13, fontWeight: 500, cursor: 'default' }}>
        <MicIcon size={13} stroke="var(--rf-accent)" />{label}
      </button>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '8px 16px 8px 14px', borderRadius: 999, background: 'var(--rf-accent-soft)', border: '1px solid var(--rf-accent)', color: 'var(--rf-accent)' }}>
      <MicIcon size={13} stroke="var(--rf-accent)" />
      <Waveform bars={16} height={16} />
      <span style={{ fontFamily: REFINE_FONT.mono, fontSize: 11.5, letterSpacing: '0.06em' }}>{elapsed}</span>
      <span style={{ width: 1, height: 14, background: 'var(--rf-accent)', opacity: .35 }} />
      <span style={{ fontFamily: REFINE_FONT.mono, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase' }}>Done</span>
    </span>
  );
}

// Hands-free dictation: a small disc, not a centrepiece. Reads as a control.
function DictationDisc({ size = 108, listening = true }) {
  return (
    <div style={{ width: size, height: size, position: 'relative', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: -14, borderRadius: '50%', background: 'radial-gradient(closest-side, var(--rf-accent-soft), transparent 72%)', filter: 'blur(6px)' }} />
      {listening && <span style={{ position: 'absolute', width: size + 12, height: size + 12, borderRadius: '50%', border: '1px solid var(--rf-accent)', opacity: .3, animation: 'rf3-breath 3.4s ease-in-out infinite' }} />}
      <button style={{ width: size, height: size, borderRadius: '50%', border: '1px solid var(--rf-border-strong)', background: 'linear-gradient(180deg, var(--rf-paper), var(--rf-surface))', boxShadow: '0 10px 26px rgba(40,28,12,.14), inset 0 1px 0 rgba(255,255,255,.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'default', position: 'relative' }}>
        <MicIcon size={19} stroke="var(--rf-accent)" />
        <Waveform bars={11} height={13} active={listening} />
      </button>
    </div>
  );
}

// ── Data display (Mirror) ───────────────────────────────────────────────────

function LineChart({ data, w = 420, h = 130, max = 21, labels, color = 'var(--rf-accent)', bands }) {
  const pad = { l: 26, r: 8, t: 10, b: 18 };
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const x = (i) => pad.l + (i / (data.length - 1)) * iw;
  const y = (v) => pad.t + ih - (v / max) * ih;
  const line = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1).toFixed(1)} ${pad.t + ih} L${pad.l} ${pad.t + ih} Z`;
  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      {bands && bands.map((b, i) => (
        <rect key={i} x={pad.l} y={y(b.to)} width={iw} height={Math.max(0, y(b.from) - y(b.to))} fill={b.color} opacity={0.5} />
      ))}
      {[0, max / 3, (max / 3) * 2, max].map((v, i) => (
        <g key={i}>
          <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke="var(--rf-rule)" strokeWidth="1" />
          <text x={0} y={y(v) + 3.5} fill="var(--rf-text-4)" style={{ fontFamily: REFINE_FONT.mono, fontSize: 9 }}>{Math.round(v)}</text>
        </g>
      ))}
      <path d={area} fill={color} opacity={0.1} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      {data.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={i === data.length - 1 ? 3.4 : 2.2} fill={i === data.length - 1 ? color : 'var(--rf-paper)'} stroke={color} strokeWidth="1.4" />)}
      {labels && labels.map((l, i) => <text key={i} x={x(i)} y={h - 2} textAnchor="middle" fill="var(--rf-text-4)" style={{ fontFamily: REFINE_FONT.mono, fontSize: 8.5, letterSpacing: '.06em' }}>{l}</text>)}
    </svg>
  );
}

// Habit consistency as a dot matrix — a record, not a streak.
function DotMatrix({ rows, cols = 21, colors }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {rows.map((r, ri) => (
        <div key={ri} style={{ display: 'grid', gridTemplateColumns: '108px 1fr', alignItems: 'center', gap: 14 }}>
          <span style={{ fontFamily: REFINE_FONT.body, fontSize: 12.5, color: 'var(--rf-text-2)' }}>{r.label}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: cols }).map((_, i) => {
              const on = r.days[i % r.days.length];
              return <span key={i} style={{ flex: 1, height: 13, borderRadius: 2, background: on ? (colors || 'var(--rf-accent)') : 'transparent', opacity: on ? (on === 2 ? 1 : 0.42) : 1, boxShadow: on ? 'none' : 'inset 0 0 0 1px var(--rf-border)' }} />;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Questionnaire row (form-like, one scrollable page) ──────────────────────

function ScaleRow({ n, question, selected, cols = 4, last }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 22, alignItems: 'center', padding: '6px 0', borderBottom: last ? 'none' : '1px solid var(--rf-rule)' }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <span style={{ fontFamily: REFINE_FONT.mono, fontSize: 10.5, color: 'var(--rf-text-4)', paddingTop: 4, width: 14, flexShrink: 0 }}>{String(n).padStart(2, '0')}</span>
        <span style={{ fontFamily: REFINE_FONT.display, fontSize: 16.5, lineHeight: 1.45, color: 'var(--rf-text)', textWrap: 'pretty' }}>{question}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 0 }}>
        {Array.from({ length: cols }).map((_, i) => (
          <span key={i} style={{ display: 'grid', placeItems: 'center' }}>
            <span style={{ width: 17, height: 17, borderRadius: '50%', border: `1px solid ${selected === i ? 'var(--rf-accent)' : 'var(--rf-border-strong)'}`, background: selected === i ? 'var(--rf-accent)' : 'transparent', display: 'grid', placeItems: 'center' }}>
              {selected === i && <span style={{ width: 5, height: 5, borderRadius: 99, background: 'var(--rf-paper)' }} />}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Chip({ children, accent, soft, style }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, fontFamily: REFINE_FONT.mono, fontSize: 10, letterSpacing: '0.13em', textTransform: 'uppercase', color: accent ? 'var(--rf-accent)' : 'var(--rf-text-3)', background: soft ? 'var(--rf-accent-soft)' : 'transparent', boxShadow: soft ? 'none' : 'inset 0 0 0 1px var(--rf-border)', ...style }}>{children}</span>
  );
}

// The paper sheet an entry is written on.
function Sheet({ children, style, ruled }) {
  return (
    <div style={{ background: 'var(--rf-paper)', border: '1px solid var(--rf-paper-edge)', borderRadius: 3, boxShadow: '0 1px 2px rgba(40,28,12,.04), 0 14px 40px -18px rgba(40,28,12,.18)', position: 'relative', ...style }}>
      {ruled && <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(180deg, transparent 0 30px, var(--rf-rule) 30px 31px)', pointerEvents: 'none', opacity: .6 }} />}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: '1 1 auto' }}>{children}</div>
    </div>
  );
}

Object.assign(window, { Eyebrow, Wordmark, Rule, Btn, Field, PageBg, TopNav, Waveform, MicIcon, MicPill, DictationDisc, LineChart, DotMatrix, ScaleRow, Chip, Sheet });
