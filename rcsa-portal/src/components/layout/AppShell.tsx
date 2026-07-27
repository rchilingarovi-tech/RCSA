import { useEffect, useMemo, useState } from 'react';
import {
  MODULES,
  MODULE_GROUPS,
  DEFAULT_MODULE_ID,
  getModule,
  type ModuleDef,
} from '../../modules/registry';
import { ComingSoon } from '../ComingSoon';
import { Icon } from '../common/Icon';
import { NavContext } from '../../state/NavContext';
import { HeaderSlotContext } from './HeaderSlot';
import { buildNotifications } from './notifications';
import { UserSwitcher } from '../../auth/UserSwitcher';
import { useSession } from '../../auth/AuthProvider';
import { canView } from '../../auth/can';
import { useStore } from '../../state/AppStore';
import { useTheme } from '../../state/ThemeProvider';
import { riskStatus, isOverdue } from '../../domain/scoring';

// UI preference only (not business data). Validated against the registry on read.
const ACTIVE_KEY = 'infosec.activeModule';
const COLLAPSE_KEY = 'infosec.sidebarCollapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function readActiveId(): string {
  try {
    const id = localStorage.getItem(ACTIVE_KEY);
    if (id && getModule(id)) return id;
  } catch {
    /* localStorage unavailable — fall through to default */
  }
  return DEFAULT_MODULE_ID;
}

const SunIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
const MoonIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

export function AppShell() {
  const store = useStore();
  const session = useSession();
  const { theme, toggleTheme } = useTheme();
  const [activeId, setActiveId] = useState<string>(readActiveId);
  const [navOpen, setNavOpen] = useState(false); // mobile drawer
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed); // desktop icon-rail
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_KEY, activeId);
    } catch {
      /* ignore persistence failure */
    }
  }, [activeId]);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore persistence failure */
    }
  }, [collapsed]);

  const active = getModule(activeId) ?? getModule(DEFAULT_MODULE_ID)!;

  // If the current user can't view the active module (e.g. after switching user),
  // fall back to the first module they can see. Footer items (Settings) are always allowed.
  useEffect(() => {
    if (active.footer || canView(session, active.id)) return;
    const first = MODULES.find((m) => !m.footer && canView(session, m.id));
    if (first && first.id !== active.id) setActiveId(first.id);
  }, [session, active.id, active.footer]);

  const blocked = !active.footer && !canView(session, active.id);

  // Live sidebar count badges (RCSA only for now).
  const badges = useMemo(() => {
    const open = store.risks.filter((r) => riskStatus(r, store.treatments) !== 'Completed').length;
    const overdue = store.treatments.filter(isOverdue).length;
    return {
      'risk-catalogue': open ? { value: open, alert: false } : null,
      'treatment-catalogue': overdue ? { value: overdue, alert: true } : null,
    } as Record<string, { value: number; alert: boolean } | null>;
  }, [store.risks, store.treatments]);

  // Real, derived alerts for the header bell (reads each repo independently).
  const notifs = buildNotifications(store.treatments);

  const select = (id: string) => {
    // Filters are per-page: switching modules drops the dashboard's chart facet
    // and slicer selections so they never follow into a catalogue page.
    if (id !== activeId) {
      store.clearGlobalFilter();
      store.patchRiskFilters({ level: '', status: '', assessment: '' });
    }
    setActiveId(id);
    setNavOpen(false);
  };

  const renderItem = (m: ModuleDef) => {
    const badge = badges[m.id];
    return (
      <li key={m.id}>
        <button
          type="button"
          onClick={() => select(m.id)}
          aria-current={m.id === active.id ? 'page' : undefined}
          title={collapsed ? m.label : undefined}
          className={`nav-item relative w-full flex items-center text-left ${collapsed ? 'lg:justify-center gap-2.5 lg:gap-0' : 'gap-2.5'} ${m.id === active.id ? 'is-active' : ''}`}
        >
          <span className="nav-icon" aria-hidden><Icon name={m.icon} size={17} /></span>
          <span className={`flex-1 truncate ${collapsed ? 'lg:hidden' : ''}`}>{m.label}</span>
          {m.status === 'planned' && <span className={`soon-tag text-[8px] font-bold uppercase ${collapsed ? 'lg:hidden' : ''}`}>Soon</span>}
          {badge && (
            <>
              <span className={`nav-badge ${badge.alert ? 'alert' : ''} ${collapsed ? 'lg:hidden' : ''}`}>{badge.value}</span>
              {/* Collapsed rail: a dot instead of the number so the count still signals */}
              <span
                className={`hidden ${collapsed ? 'lg:block' : ''} absolute top-1.5 right-1.5 w-2 h-2 rounded-full`}
                style={{ background: badge.alert ? 'var(--crit)' : 'var(--accent)' }}
                aria-hidden
              />
            </>
          )}
        </button>
      </li>
    );
  };

  return (
    <NavContext.Provider value={{ activeId: active.id, navigate: select }}>
    <HeaderSlotContext.Provider value={headerSlot}>
      <div className="h-screen flex overflow-hidden">
        {/* Mobile overlay */}
        {navOpen && (
          <div className="fixed inset-0 modal-bg z-30 lg:hidden" onClick={() => setNavOpen(false)} aria-hidden />
        )}

        {/* Sidebar */}
        <aside
          className={`app-sidebar fixed lg:static z-40 inset-y-0 left-0 w-[248px] shrink-0 flex flex-col
            overflow-y-auto overflow-x-hidden transition-all duration-200
            ${collapsed ? 'lg:w-[68px]' : 'lg:w-[248px]'}
            ${navOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
        >
          <div className={`py-4 flex items-center gap-3 border-b ${collapsed ? 'lg:px-0 lg:justify-center px-5' : 'px-5'}`} style={{ borderColor: 'var(--side-border)' }}>
            <span
              className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg,#0d9488,#2dd4bf)', color: '#04211d' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z" /><path d="M9 12l2 2 4-4" />
              </svg>
            </span>
            <div className={`leading-tight ${collapsed ? 'lg:hidden' : ''}`}>
              <div className="brand text-[15px]">InfoSec Portal</div>
              <p className="brand-sub text-[11px]">Information Security platform</p>
            </div>
          </div>

          <nav className="flex-1 p-3 space-y-5">
            {MODULE_GROUPS.map((group) => {
              const items = MODULES.filter((m) => m.group === group && canView(session, m.id));
              if (items.length === 0) return null;
              return (
                <div key={group}>
                  <p className={`nav-group-label px-2 mb-1.5 text-[10px] font-bold uppercase tracking-wider ${collapsed ? 'lg:hidden' : ''}`}>
                    {group}
                  </p>
                  {/* Collapsed rail: a slim divider stands in for the hidden group label */}
                  {collapsed && <div className="hidden lg:block mx-auto w-6 border-t mb-1.5" style={{ borderColor: 'var(--side-border)' }} />}
                  <ul className="space-y-0.5">{items.map(renderItem)}</ul>
                </div>
              );
            })}

            {/* Footer-pinned items (Settings) — always visible so anyone can reach their profile */}
            <div className="pt-3 border-t" style={{ borderColor: 'var(--side-border)' }}>
              <ul className="space-y-0.5">{MODULES.filter((m) => m.footer).map(renderItem)}</ul>
            </div>
          </nav>

        </aside>

        {/* Main column */}
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="app-header h-[60px] shrink-0 flex items-center gap-3 px-5 lg:px-6">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              aria-label="Open menu"
              className="hdr-btn lg:hidden"
            >
              ☰
            </button>
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hdr-btn hidden lg:inline-flex"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /><path d="M15 10l-2 2 2 2" />
              </svg>
            </button>
            <div className="min-w-0">
              <div className="text-[16px] font-bold tracking-tight truncate" style={{ color: 'var(--text)' }}>
                {active.label}
              </div>
              <div className="text-[12px] truncate" style={{ color: 'var(--text3)' }}>{active.description}</div>
            </div>
            <span
              className="hidden sm:inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md shrink-0"
              style={{ background: 'var(--med-bg)', color: 'var(--med)' }}
              title="Demonstration build — not connected to a production backend"
            >
              Demo
            </span>
            <div className="flex-1" />
            {/* per-page action buttons portal here */}
            <div ref={setHeaderSlot} className="flex flex-wrap items-center justify-end gap-2" />
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'light' ? 'Switch to dark' : 'Switch to light'}
              aria-label="Toggle theme"
              className="hdr-btn"
            >
              {theme === 'light' ? MoonIcon : SunIcon}
            </button>
            <button
              type="button"
              onClick={() => setNotifOpen((o) => !o)}
              title="Notifications"
              aria-label="Notifications"
              className="hdr-btn relative"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
              {notifs.length > 0 && (
                <span
                  className="absolute flex items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{ top: 2, right: 2, minWidth: 15, height: 15, padding: '0 3px', background: 'var(--crit)', border: '1.5px solid var(--surface)' }}
                >
                  {notifs.length}
                </span>
              )}
            </button>
            <div className="w-px h-6 mx-1" style={{ background: 'var(--border)' }} />
            <UserSwitcher />
          </header>

          <main className="flex-1 min-w-0 overflow-y-auto">
            {blocked ? (
              <div className="p-6">
                <div className="section-card max-w-md mx-auto mt-16 p-8 text-center">
                  <div className="text-base font-semibold mb-1" style={{ color: 'var(--text)' }}>No access</div>
                  <p className="text-sm" style={{ color: 'var(--text3)' }}>
                    {session.user.displayName} doesn't have permission to view <b>{active.label}</b>.
                  </p>
                </div>
              </div>
            ) : active.Component ? (
              <active.Component />
            ) : (
              <div className="p-6"><ComingSoon module={active} /></div>
            )}
          </main>
        </div>

        {/* Notifications dropdown */}
        {notifOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} aria-hidden />
            <div className="fixed z-50 section-card overflow-hidden" style={{ top: 56, right: 20, width: 344 }}>
              <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
                <span className="text-[13px] font-bold" style={{ color: 'var(--text)' }}>Notifications</span>
                {notifs.length > 0 && <span className="nav-badge alert ml-auto">{notifs.length}</span>}
              </div>
              <div className="max-h-[360px] overflow-y-auto">
                {notifs.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text3)' }}>You're all caught up.</div>
                ) : (
                  notifs.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => { select(n.moduleId); setNotifOpen(false); }}
                      className="w-full text-left flex gap-3 px-4 py-3 border-b"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `var(--${n.k}-bg)`, color: `var(--${n.k})` }}>
                        <Icon name={n.icon} size={15} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>{n.title}</span>
                        <span className="block text-[11.5px] mt-0.5" style={{ color: 'var(--text3)' }}>{n.body}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </HeaderSlotContext.Provider>
    </NavContext.Provider>
  );
}
