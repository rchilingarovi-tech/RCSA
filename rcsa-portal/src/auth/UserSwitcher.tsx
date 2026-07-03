import { useState } from 'react';
import { useAuth, useSession } from './AuthProvider';

// Account menu in the top-right header: shows who you're signed in as, a demo
// "switch user" shortcut, and Sign out. Dropdown is fixed to the top-right corner.
const initials = (name: string) =>
  name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

const avatar = 'rounded-full flex items-center justify-center font-semibold text-white shrink-0';
const avatarBg = 'linear-gradient(135deg,#334155,#0f766e)';

export function UserSwitcher() {
  const { users, switchUser, logout } = useAuth();
  const session = useSession();
  const [open, setOpen] = useState(false);
  const u = session.user;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-[var(--surface2)]"
        title="Account"
        aria-label="Account menu"
      >
        <span className={`${avatar} w-8 h-8 text-xs`} style={{ background: avatarBg }}>{initials(u.displayName)}</span>
        <span className="hidden md:block text-left leading-tight min-w-0 max-w-[150px]">
          <span className="block text-[12.5px] font-semibold truncate" style={{ color: 'var(--text)' }}>{u.displayName}</span>
          <span className="block text-[11px] truncate" style={{ color: 'var(--text3)' }}>{u.title}</span>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text3)' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="fixed z-50 section-card overflow-hidden" style={{ top: 56, right: 16, width: 268 }}>
            <div className="px-4 py-3 border-b flex items-center gap-2.5" style={{ borderColor: 'var(--border)' }}>
              <span className={`${avatar} w-9 h-9 text-[13px]`} style={{ background: avatarBg }}>{initials(u.displayName)}</span>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--text)' }}>{u.displayName}</div>
                <div className="text-[11px] truncate" style={{ color: 'var(--text3)' }}>{u.email}</div>
              </div>
            </div>

            <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
              Demo · switch user
            </div>
            <div className="max-h-[40vh] overflow-y-auto">
              {users.filter((usr) => usr.active).map((usr) => {
                const sel = usr.id === u.id;
                return (
                  <button
                    key={usr.id}
                    onClick={() => { switchUser(usr.id); setOpen(false); }}
                    className="w-full text-left px-4 py-2.5 flex items-center gap-2.5 border-t"
                    style={{ borderColor: 'var(--border)', background: sel ? 'var(--surface2)' : 'transparent' }}
                  >
                    <span className={`${avatar} w-7 h-7 text-[10px]`} style={{ background: sel ? 'var(--accent)' : avatarBg }}>{initials(usr.displayName)}</span>
                    <span className="min-w-0">
                      <span className="block text-[12px] font-semibold truncate" style={{ color: 'var(--text)' }}>{usr.displayName}</span>
                      <span className="block text-[11px] truncate" style={{ color: 'var(--text3)' }}>{usr.title}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => { setOpen(false); logout(); }}
              className="w-full text-left px-4 py-3 flex items-center gap-2.5 border-t font-semibold text-sm"
              style={{ borderColor: 'var(--border)', color: 'var(--crit)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
