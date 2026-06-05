// V1 — Recruiter Workbench
// Information-dense, two-column scannable layout. Vacancies up top.
// Experience as compact collapsed timeline. Activity feed with filter chips.

function V1AppliedVacancies() {
  return (
    <Card padding={20}>
      <SectionHeader
        title="Applied vacancies"
        subtitle="2 of 5 slots active"
        action={<Button variant="secondary" size="sm" icon={IconPlus}>Add to vacancy</Button>}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {CANDIDATE.vacancies.map(v => (
          <div key={v.id} style={{
            border: `1px solid ${T.border}`, borderRadius: 10, padding: 16,
            background: T.card,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, background: T.primaryTint,
                  color: T.primary, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <IconBriefcase size={16} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.fg }}>{v.title}</div>
                    <StatusPill status="incomplete" size="sm" />
                  </div>
                  <div style={{ fontSize: 12, color: T.fg3, marginTop: 2 }}>
                    {v.department} · Applied {v.applied}
                  </div>
                </div>
              </div>
              <button style={{
                width: 28, height: 28, borderRadius: 6, border: 'none',
                background: 'transparent', color: T.fg3, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IconMore size={15} />
              </button>
            </div>
            <PipelineMini stageIdx={v.stageIdx} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function V1Experience() {
  const [expanded, setExpanded] = React.useState(['e1']);
  return (
    <Card padding={20}>
      <SectionHeader
        icon={IconBriefcase}
        title="Experience"
        count={CANDIDATE.experience.length}
        action={<Button variant="ghost" size="sm" icon={IconPlus}>Add</Button>}
      />
      <div style={{ position: 'relative', paddingLeft: 18 }}>
        {/* timeline rail */}
        <div style={{
          position: 'absolute', left: 5, top: 6, bottom: 6,
          width: 1, background: T.border,
        }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {CANDIDATE.experience.map((e, i) => {
            const isOpen = expanded.includes(e.id);
            return (
              <div key={e.id} style={{ position: 'relative' }}>
                {/* timeline dot */}
                <div style={{
                  position: 'absolute', left: -18, top: 13, width: 11, height: 11,
                  borderRadius: '50%', background: i === 0 ? T.primary : T.card,
                  border: `2px solid ${i === 0 ? T.primary : T.border}`,
                }} />
                <div style={{
                  padding: '10px 12px', borderRadius: 8,
                  background: isOpen ? T.muted : 'transparent',
                  border: `1px solid ${isOpen ? T.border : 'transparent'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: T.fg }}>{e.title}</span>
                        <span style={{ fontSize: 12.5, color: T.fg2 }}>· {e.company}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: T.fg3, marginTop: 2 }}>
                        {e.start} — {e.end} · {e.duration}
                      </div>
                    </div>
                    <button style={{
                      width: 24, height: 24, borderRadius: 5, border: 'none',
                      background: 'transparent', color: T.fg3, cursor: 'pointer', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s',
                    }}>
                      <IconChevronDown size={14} />
                    </button>
                  </div>
                  {isOpen && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.borderLight}` }}>
                      <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {e.bullets.map((b, j) => (
                          <li key={j} style={{ fontSize: 12.5, color: T.fg2, lineHeight: 1.55 }}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function V1Education() {
  return (
    <Card padding={20}>
      <SectionHeader
        icon={IconGraduation}
        title="Education"
        count={CANDIDATE.education.length}
        action={<Button variant="ghost" size="sm" icon={IconPlus}>Add</Button>}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {CANDIDATE.education.map(ed => (
          <div key={ed.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.borderLight}`,
          }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: T.fg }}>{ed.school}</div>
              <div style={{ fontSize: 12, color: T.fg2, marginTop: 2 }}>
                {ed.degree}, {ed.field}
              </div>
            </div>
            <span style={{ fontSize: 12, color: T.fg3, fontWeight: 500 }}>{ed.start} — {ed.end}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function V1Activity() {
  const filters = ['All', 'Notes', 'Interviews', 'Stage changes', 'Documents'];
  const [active, setActive] = React.useState('All');
  return (
    <Card padding={20}>
      <SectionHeader
        icon={IconMessage}
        title="Activity"
        count={CANDIDATE.activity.length}
        action={<Button variant="ghost" size="sm" icon={IconPlus}>Add note</Button>}
      />
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {filters.map(f => (
          <button key={f} onClick={() => setActive(f)} style={{
            padding: '5px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 500,
            border: `1px solid ${active === f ? T.primary : T.border}`,
            background: active === f ? T.primaryTint : T.card,
            color: active === f ? T.primaryFg : T.fg2,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>{f}</button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {CANDIDATE.activity.map((a, i) => {
          const isLast = i === CANDIDATE.activity.length - 1;
          return (
            <div key={a.id} style={{ display: 'flex', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <ActivityIcon kind={a.kind} />
                {!isLast && <div style={{ flex: 1, width: 1, background: T.border, marginTop: 4, marginBottom: 4 }} />}
              </div>
              <div style={{ flex: 1, paddingBottom: isLast ? 0 : 14 }}>
                <div style={{ fontSize: 13, color: T.fg, fontWeight: 500 }}>
                  {a.text}
                </div>
                {a.meta && a.kind === 'note' ? (
                  <div style={{
                    marginTop: 6, padding: '10px 12px', background: T.muted,
                    borderRadius: 8, fontSize: 12.5, color: T.fg, lineHeight: 1.5,
                  }}>{a.meta}</div>
                ) : a.meta ? (
                  <div style={{ fontSize: 12, color: T.fg3, marginTop: 2 }}>{a.meta}</div>
                ) : null}
                <div style={{ fontSize: 11.5, color: T.fg3, marginTop: 4 }}>
                  {a.actor ? `${a.actor} · ` : ''}{a.when}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.borderLight}` }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
          border: `1px solid ${T.border}`, borderRadius: 8,
        }}>
          <Avatar size={28} initials="ME" />
          <input
            placeholder="Add a note about this candidate…"
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: 13,
              fontFamily: 'inherit', background: 'transparent', color: T.fg,
            }}
          />
          <Button variant="primary" size="sm">Post</Button>
        </div>
      </div>
    </Card>
  );
}

function V1RightRail() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ContactCard />
      <Card padding={20}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: T.fg, margin: 0 }}>Documents</h2>
          <Button variant="secondary" size="sm" icon={IconUpload}>Upload</Button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {CANDIDATE.documents.map((d, i) => (<DocumentRow key={i} doc={d} />))}
        </div>
      </Card>
      <Card padding={20}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: T.fg, margin: 0 }}>Interviews</h2>
          <Button variant="secondary" size="sm" icon={IconCalendarPlus}>Schedule</Button>
        </div>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '24px 0', color: T.fg3, gap: 8,
        }}>
          <IconCalendar size={28} />
          <div style={{ fontSize: 12.5 }}>No interviews scheduled</div>
        </div>
      </Card>
      {/* Metadata footer — moved out of hero */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px',
        padding: '14px 20px', background: T.muted, borderRadius: 10,
        border: `1px solid ${T.borderLight}`,
      }}>
        <Meta label="Source" value={CANDIDATE.source} />
        <Meta label="Added" value={CANDIDATE.addedRelative} />
        <Meta label="Last updated" value={CANDIDATE.lastUpdated} />
        <Meta label="Candidate ID" value="C-00481" mono />
      </div>
    </div>
  );
}

function Meta({ label, value, mono }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: T.fg3, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{
        fontSize: 11.5, color: T.fg, fontWeight: 500, marginTop: 2,
        fontFamily: mono ? "'DM Mono', monospace" : 'inherit',
      }}>{value}</div>
    </div>
  );
}

function V1RecruiterWorkbench() {
  return (
    <div data-screen-label="V1 Recruiter Workbench" style={{
      display: 'flex', width: '100%', height: '100%', background: T.bg,
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <ChromeSidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ChromeHeader />
        <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>
          <CandidatePageHeader />
          <SummaryStrip />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 20, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <V1AppliedVacancies />
              <V1Experience />
              <V1Education />
              <V1Activity />
            </div>
            <V1RightRail />
          </div>
        </main>
      </div>
    </div>
  );
}

Object.assign(window, { V1RecruiterWorkbench });
