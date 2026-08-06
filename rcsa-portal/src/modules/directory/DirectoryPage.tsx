import { useMemo } from 'react';
import { MODULES } from '../registry';
import { Pill } from '../../components/common/Pill';
import { PageHeader } from '../rcsa/PageHeader';
import { useAuth } from '../../auth/AuthProvider';
import { GROUP_ROLE_MAP } from '../../auth/groupRoleMap';

const initials = (name: string) => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

const FLOW: string[] = [
  'User signs in — the app posts credentials to the server (never the browser).',
  'Server performs an LDAP/AD bind to validate the credentials.',
  "Server reads the account's directory groups (memberOf).",
  'Groups are translated to platform access via the mapping below.',
  'Server returns a signed session (identity + resolved per-module rights).',
  'The app renders menus/actions from the session — and the server re-checks every action.',
];

export function DirectoryPage() {
  const { users, getUserAccess } = useAuth();
  const moduleLabel = useMemo(() => {
    const m = new Map(MODULES.map((x) => [x.id, x.label] as const));
    return (id: string) => m.get(id) ?? id;
  }, []);
  const totalModules = useMemo(() => MODULES.filter((x) => !x.footer).length, []);

  return (
    <>
      <PageHeader />
      <div className="p-6 space-y-5">
        {/* Integration model */}
        <div className="section-card p-5">
          <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--text)' }}>Active Directory integration model</h2>
          <p className="text-xs mb-3" style={{ color: 'var(--text3)' }}>
            Identities below are shaped exactly like AD accounts, so the platform is ready to bind to your directory.
            In this demo the session is mocked locally (the “view as” switcher); wiring steps 1–5 to a real AD is a backend task — the frontend contract is already in place.
          </p>
          <ol className="space-y-1.5">
            {FLOW.map((step, i) => (
              <li key={i} className="flex gap-2.5 text-sm" style={{ color: 'var(--text2)' }}>
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: 'var(--surface3)', color: 'var(--link)' }}>{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* Group → role mapping */}
        <div className="section-card">
          <div className="px-5 py-3 border-b bg-gray-50">
            <h2 className="text-base font-semibold text-gray-800">Directory group → access mapping</h2>
            <p className="text-xs text-gray-500 mt-0.5">The single place IT configures who gets what — applied to each user's directory groups after migration.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 text-[10.5px] font-semibold tracking-wide uppercase">AD group</th>
                  <th className="text-left px-4 py-3 text-[10.5px] font-semibold tracking-wide uppercase">Resulting access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {GROUP_ROLE_MAP.map((g) => (
                  <tr key={g.group} className="risk-row">
                    <td className="px-4 py-3"><span className="font-mono text-xs font-semibold" style={{ color: 'var(--link)' }}>{g.group}</span></td>
                    <td className="px-4 py-3" style={{ color: 'var(--text2)' }}>{g.access}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Identity cards */}
        <div>
          <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>Directory accounts ({users.length})</h2>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 330px), 1fr))' }}>
            {users.map((u) => {
              const access = getUserAccess(u.id);
              const ids = Object.keys(access);
              return (
                <div key={u.id} className="section-card p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0" style={{ background: 'linear-gradient(135deg,#334155,#0f766e)' }}>{initials(u.displayName)}</span>
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-bold truncate" style={{ color: 'var(--text)' }}>{u.displayName}</div>
                      <div className="text-[11.5px] truncate" style={{ color: 'var(--text3)' }}>{u.title}</div>
                    </div>
                    {u.isAdmin && <span className="ml-auto"><Pill text="Admin" k="info" /></span>}
                  </div>

                  <dl className="text-[12px] space-y-1 mb-3">
                    <div className="flex gap-2"><dt className="w-28 shrink-0" style={{ color: 'var(--text3)' }}>UPN</dt><dd className="font-mono truncate" style={{ color: 'var(--text2)' }}>{u.upn}</dd></div>
                    <div className="flex gap-2"><dt className="w-28 shrink-0" style={{ color: 'var(--text3)' }}>sAMAccountName</dt><dd className="font-mono truncate" style={{ color: 'var(--text2)' }}>{u.sAMAccountName}</dd></div>
                    <div className="flex gap-2"><dt className="w-28 shrink-0" style={{ color: 'var(--text3)' }}>Email</dt><dd className="truncate" style={{ color: 'var(--text2)' }}>{u.email}</dd></div>
                  </dl>

                  <div className="mb-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text3)' }}>Member of</div>
                    <div className="flex flex-wrap gap-1">
                      {u.groups.map((g) => <span key={g} className="font-mono text-[10.5px] px-2 py-0.5 rounded" style={{ background: 'var(--surface3)', color: 'var(--text2)' }}>{g}</span>)}
                    </div>
                  </div>

                  <details>
                    <summary className="cursor-pointer text-[11px] font-semibold" style={{ color: 'var(--link)' }}>
                      Access: {ids.length} of {totalModules} modules
                    </summary>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {ids.length === 0
                        ? <span className="text-[11px]" style={{ color: 'var(--text3)' }}>No module access</span>
                        : ids.map((id) => <span key={id} className="text-[10.5px] px-2 py-0.5 rounded" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>{moduleLabel(id)}</span>)}
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
