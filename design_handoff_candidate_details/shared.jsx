// Shared chrome and primitives across the 3 variations.

// ── Tokens ──────────────────────────────────────────────────────────
const T = {
  bg: 'oklch(0.985 0.002 247)',
  fg: 'oklch(0.15 0.02 250)',
  fg2: 'oklch(0.5 0.02 250)',
  fg3: 'oklch(0.65 0.02 250)',
  card: 'oklch(1 0 0)',
  border: 'oklch(0.9 0.01 250)',
  borderLight: 'oklch(0.95 0.01 250)',
  primary: 'oklch(0.55 0.18 250)',
  primaryTint: 'oklch(0.55 0.18 250 / 0.08)',
  primaryTintStrong: 'oklch(0.55 0.18 250 / 0.15)',
  primaryFg: 'oklch(0.35 0.15 250)',
  accent: 'oklch(0.7 0.15 165)',
  accentTint: 'oklch(0.7 0.15 165 / 0.15)',
  accentFg: 'oklch(0.35 0.12 165)',
  success: 'oklch(0.65 0.17 145)',
  successTint: 'oklch(0.65 0.17 145 / 0.15)',
  successFg: 'oklch(0.35 0.13 145)',
  warning: 'oklch(0.75 0.15 70)',
  warningTint: 'oklch(0.75 0.15 70 / 0.2)',
  warningFg: 'oklch(0.38 0.1 70)',
  danger: 'oklch(0.577 0.245 27)',
  dangerTint: 'oklch(0.577 0.245 27 / 0.12)',
  dangerFg: 'oklch(0.45 0.2 27)',
  muted: 'oklch(0.96 0.005 247)',
  sidebar: 'oklch(0.15 0.02 250)',
  sidebarFg: 'oklch(0.95 0.01 250)',
  sidebarFgMuted: 'oklch(0.95 0.01 250 / 0.6)',
  sidebarBorder: 'oklch(0.25 0.02 250)',
  sidebarAccent: 'oklch(0.25 0.02 250)',
};

// ── Sidebar ─────────────────────────────────────────────────────────
function ChromeSidebar() {
  const nav = [
    { id: 'dashboard', label: 'Dashboard', icon: IconLayoutDashboard, active: false },
    { id: 'vacancies', label: 'Vacancies', icon: IconBriefcase, active: false },
    { id: 'candidates', label: 'Candidates', icon: IconUsers, active: true },
    { id: 'interviews', label: 'Interviews', icon: IconCalendar, active: false },
    { id: 'settings', label: 'Settings', icon: IconSettings, active: false },
    { id: 'subscription', label: 'Subscription', icon: IconCreditCard, active: false },
  ];
  return (
    <aside style={{
      width: 220, minWidth: 220, background: T.sidebar,
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '0 18px',
        height: 60, borderBottom: `1px solid ${T.sidebarBorder}`,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7, background: T.primary,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
        }}>
          <IconBriefcase size={14} />
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: T.sidebarFg }}>HRHandle</span>
      </div>
      <div style={{ padding: '10px 18px', borderBottom: `1px solid ${T.sidebarBorder}` }}>
        <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'oklch(0.95 0.01 250 / 0.4)', fontWeight: 500 }}>Organization</div>
        <div style={{ fontSize: 12, fontWeight: 500, color: T.sidebarFg, marginTop: 2 }}>Acme Corp</div>
      </div>
      <nav style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {nav.map(({ id, label, icon: Icon, active }) => (
          <div key={id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px',
            borderRadius: 8, fontSize: 12.5, fontWeight: 500,
            background: active ? T.sidebarAccent : 'transparent',
            color: active ? T.sidebarFg : T.sidebarFgMuted,
          }}>
            <Icon size={15} />
            {label}
          </div>
        ))}
      </nav>
      <div style={{ padding: '12px 18px', borderTop: `1px solid ${T.sidebarBorder}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 10, color: 'oklch(0.95 0.01 250 / 0.4)' }}>Plan</span>
          <span style={{ fontSize: 10, fontWeight: 500, color: T.primary }}>Trial</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: 'oklch(0.95 0.01 250 / 0.4)' }}>Status</span>
          <span style={{ fontSize: 10, fontWeight: 500, color: T.sidebarFg }}>Active</span>
        </div>
      </div>
    </aside>
  );
}

// ── Top breadcrumb header ───────────────────────────────────────────
function ChromeHeader() {
  return (
    <div style={{
      height: 56, padding: '0 28px', flexShrink: 0,
      borderBottom: `1px solid ${T.border}`, background: T.card,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <span style={{ color: T.fg3 }}>HRHandle</span>
        <span style={{ color: T.fg3 }}>›</span>
        <a style={{ color: T.fg3, textDecoration: 'none' }}>Candidates</a>
        <span style={{ color: T.fg3 }}>›</span>
        <span style={{ color: T.fg, fontWeight: 500 }}>{CANDIDATE.fullName}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ position: 'relative', color: T.fg3 }}>
          <IconBell size={18} />
          <span style={{
            position: 'absolute', top: -3, right: -4, width: 14, height: 14,
            borderRadius: '50%', background: T.danger, color: 'white',
            fontSize: 9, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>5</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: T.fg }}>aleksandre merabishvili</div>
            <div style={{ fontSize: 10, color: T.fg3 }}>Trial · Trial</div>
          </div>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', background: T.primaryTint,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 600, color: T.primary,
          }}>AM</div>
        </div>
      </div>
    </div>
  );
}

// ── Status pill ─────────────────────────────────────────────────────
function StatusPill({ status = 'active', size = 'md' }) {
  const map = {
    active: { bg: T.successTint, color: T.successFg, label: 'Active' },
    new: { bg: T.accentTint, color: T.accentFg, label: 'New' },
    in_process: { bg: T.warningTint, color: T.warningFg, label: 'In Process' },
    hired: { bg: T.successTint, color: T.successFg, label: 'Hired' },
    rejected: { bg: T.dangerTint, color: T.dangerFg, label: 'Rejected' },
    applied: { bg: T.primaryTintStrong, color: T.primaryFg, label: 'Applied' },
    incomplete: { bg: T.warningTint, color: T.warningFg, label: 'Incomplete' },
  };
  const s = map[status] || map.active;
  const isSm = size === 'sm';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: isSm ? '2px 8px' : '3px 10px',
      borderRadius: 999, fontSize: isSm ? 10.5 : 11.5, fontWeight: 600,
      background: s.bg, color: s.color, whiteSpace: 'nowrap',
    }}>{s.label}</span>
  );
}

// ── Card ────────────────────────────────────────────────────────────
function Card({ children, padding = 20, style }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
      padding, ...style,
    }}>{children}</div>
  );
}

// ── Section header (within a card) ──────────────────────────────────
function SectionHeader({ icon: Icon, title, subtitle, action, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {Icon && <Icon size={16} color={T.fg2} />}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: T.fg, margin: 0 }}>{title}</h2>
          {count != null && (
            <span style={{ fontSize: 12, color: T.fg3, fontWeight: 500 }}>{count}</span>
          )}
          {subtitle && (
            <span style={{ fontSize: 12, color: T.fg3 }}>· {subtitle}</span>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

// ── Avatar ──────────────────────────────────────────────────────────
function Avatar({ size = 56, initials = 'AM' }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: T.primaryTint,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.32, fontWeight: 600, color: T.primary, flexShrink: 0,
    }}>{initials}</div>
  );
}

// ── Buttons ─────────────────────────────────────────────────────────
function Button({ children, variant = 'primary', size = 'md', icon: Icon, style }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', border: 'none',
    borderRadius: 8, whiteSpace: 'nowrap',
  };
  const sizeMap = {
    sm: { padding: '6px 12px', fontSize: 12, height: 30 },
    md: { padding: '8px 14px', fontSize: 13, height: 36 },
    lg: { padding: '10px 18px', fontSize: 14, height: 42 },
  };
  const variantMap = {
    primary: { background: T.primary, color: 'white' },
    secondary: { background: T.card, color: T.fg, border: `1px solid ${T.border}` },
    ghost: { background: 'transparent', color: T.fg2 },
    danger: { background: 'transparent', color: T.danger, border: `1px solid ${T.danger}` },
  };
  return (
    <button style={{ ...base, ...sizeMap[size], ...variantMap[variant], ...style }}>
      {Icon && <Icon size={size === 'sm' ? 13 : 14} />}
      {children}
    </button>
  );
}

// ── Page header (candidate-level bar across all variations) ─────────
function CandidatePageHeader({ density = 'normal' }) {
  const c = CANDIDATE;
  const tall = density === 'tall';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: tall ? 24 : 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button style={{
          width: 36, height: 36, borderRadius: 8,
          background: T.card, border: `1px solid ${T.border}`, color: T.fg2,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <IconChevronLeft size={16} />
        </button>
        <Avatar size={tall ? 64 : 52} initials={c.initials} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{
              fontSize: tall ? 28 : 24, fontWeight: 700, color: T.fg, margin: 0,
              letterSpacing: '-0.01em',
            }}>{c.fullName}</h1>
            <StatusPill status={c.status} />
          </div>
          <div style={{ fontSize: 13, color: T.fg2, marginTop: 4 }}>
            {c.headline}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          height: 36, padding: '0 12px', border: `1px solid ${T.border}`,
          borderRadius: 8, fontSize: 13, color: T.successFg, background: T.card,
          fontWeight: 500,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.success }} />
          Active
          <IconChevronDown size={14} color={T.fg3} />
        </div>
        <Button variant="primary" icon={IconEdit}>Edit</Button>
      </div>
    </div>
  );
}

// ── Compact summary strip (chip row with key facts) ─────────────────
function SummaryStrip() {
  const c = CANDIDATE;
  const items = [
    { icon: IconMapPin, label: c.location, sub: c.timezone },
    { icon: IconBriefcase, label: `${c.yearsExperience}+ years experience` },
    { icon: IconDollar, label: c.salaryExpectation },
    { icon: IconClock, label: `${c.noticePeriod} notice` },
    { icon: IconGlobe, label: c.languages.join(', ') },
  ];
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
      padding: '14px 20px', marginBottom: 20,
      display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap',
    }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <it.icon size={15} color={T.fg2} />
          <span style={{ fontSize: 13, color: T.fg, fontWeight: 500 }}>{it.label}</span>
          {it.sub && <span style={{ fontSize: 12, color: T.fg3 }}>· {it.sub}</span>}
        </div>
      ))}
    </div>
  );
}

// ── Contact card (right rail) ───────────────────────────────────────
function ContactCard() {
  const c = CANDIDATE.contact;
  const rows = [
    { icon: IconMail, label: 'Email', value: c.email, mono: true },
    { icon: IconPhone, label: 'Phone', value: c.phone },
    { icon: IconLinkedIn, label: 'LinkedIn', value: 'View Profile', link: true },
  ];
  return (
    <Card padding={20}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: T.fg, margin: 0, marginBottom: 14 }}>Contact</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.map((r, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 11,
            padding: '8px 0',
            borderBottom: i < rows.length - 1 ? `1px solid ${T.borderLight}` : 'none',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: T.muted,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.fg2,
              flexShrink: 0,
            }}>
              <r.icon size={14} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10.5, color: T.fg3, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{r.label}</div>
              <div style={{
                fontSize: 12.5,
                color: r.link ? T.primary : T.fg,
                fontWeight: r.link ? 500 : 400,
                marginTop: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{r.value}</div>
            </div>
            <button style={{
              width: 26, height: 26, borderRadius: 6, background: 'transparent',
              border: 'none', color: T.fg3, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconCopy size={13} />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Document row (used in Documents card) ───────────────────────────
function DocumentRow({ doc, compact = false }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: compact ? '8px 10px' : '10px 12px',
      background: T.muted, border: `1px solid ${T.borderLight}`, borderRadius: 8,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6, background: T.card, color: T.danger,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        border: `1px solid ${T.borderLight}`,
      }}>
        <IconFileText size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12.5, color: T.fg, fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{doc.name}</div>
        <div style={{ fontSize: 10.5, color: T.fg3, marginTop: 1 }}>
          {doc.size} · {doc.uploaded}
        </div>
      </div>
      <button style={{
        width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent',
        color: T.fg3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <IconExternal size={13} />
      </button>
    </div>
  );
}

// ── Activity item ───────────────────────────────────────────────────
function ActivityIcon({ kind }) {
  const map = {
    application: { Icon: IconBriefcase, color: T.primary, bg: T.primaryTint },
    document: { Icon: IconFileText, color: T.accent, bg: T.accentTint },
    stage: { Icon: IconArrowRight, color: T.warningFg, bg: T.warningTint },
    note: { Icon: IconMessage, color: T.fg2, bg: T.muted },
    interview: { Icon: IconCalendar, color: T.successFg, bg: T.successTint },
  };
  const { Icon, color, bg } = map[kind] || map.note;
  return (
    <div style={{
      width: 30, height: 30, borderRadius: '50%', background: bg, color,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <Icon size={14} />
    </div>
  );
}

// ── Pipeline mini-bar (segments showing stage progress) ─────────────
function PipelineMini({ stageIdx = 0 }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {PIPELINE_STAGES.map((s, i) => {
        const done = i < stageIdx;
        const current = i === stageIdx;
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{
              padding: '3px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 500,
              background: current ? T.primaryTintStrong : done ? T.successTint : T.muted,
              color: current ? T.primaryFg : done ? T.successFg : T.fg3,
              border: current ? `1px solid ${T.primary}` : '1px solid transparent',
            }}>{s}</div>
            {i < PIPELINE_STAGES.length - 1 && (
              <div style={{ width: 8, height: 1, background: done ? T.success : T.border }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

Object.assign(window, {
  T,
  ChromeSidebar, ChromeHeader,
  StatusPill, Card, SectionHeader, Avatar, Button,
  CandidatePageHeader, SummaryStrip,
  ContactCard, DocumentRow,
  ActivityIcon, PipelineMini,
});
