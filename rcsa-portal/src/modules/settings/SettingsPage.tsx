import { useEffect, useMemo, useState } from 'react';
import { MODULES } from '../registry';
import { PageHeader } from '../rcsa/PageHeader';
import { useUi } from '../../components/common/UiProvider';
import { useAuth, useSession } from '../../auth/AuthProvider';
import { ACTIONS, ACTION_LABELS, rolePreset, type Action, type GrantMap, type Role } from '../../auth/types';
import { UsersTab } from './UsersTab';

const PRESET_OPTIONS: { value: Role | 'none'; label: string }[] = [
  { value: 'none', label: 'No access' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'editor', label: 'Editor' },
  { value: 'admin', label: 'Full' },
];

const th = 'px-3 py-2 text-[10.5px] font-semibold tracking-wide uppercase';

// ── Profile tab ───────────────────────────────────────────────────────────────
function ProfileTab() {
  const session = useSession();
  const u = session.user;
  const rows: [string, string][] = [
    ['Display name', u.displayName],
    ['Title', u.title],
    ['Email', u.email],
    ['User principal name', u.upn],
    ['Account (sAMAccountName)', u.sAMAccountName],
    ['Directory groups', u.groups.join(', ') || '—'],
  ];
  return (
    <div className="section-card max-w-2xl">
      <div className="px-5 py-3 border-b bg-gray-50">
        <h2 className="text-base font-semibold text-gray-800">Profile</h2>
        <p className="text-xs text-gray-500 mt-0.5">Synced from Active Directory — read-only here.</p>
      </div>
      <div className="divide-y divide-gray-100">
        {rows.map(([k, v]) => (
          <div key={k} className="px-5 py-3 flex gap-4">
            <div className="w-48 shrink-0 text-[12px] font-semibold" style={{ color: 'var(--text3)' }}>{k}</div>
            <div className="text-sm" style={{ color: 'var(--text)' }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Access Control tab (admin only) ────────────────────────────────────────────
function AccessTab() {
  const ui = useUi();
  const { users, getUserAccess, setUserGrants, resetGrants } = useAuth();
  const RIGHT_MODULES = useMemo(() => MODULES.filter((m) => !m.footer), []); // settings itself excluded
  const [targetId, setTargetId] = useState(users[0].id);
  const [draft, setDraft] = useState<GrantMap>(() => getUserAccess(users[0].id));

  // Reload the matrix whenever the selected user changes.
  useEffect(() => { setDraft(getUserAccess(targetId)); }, [targetId, getUserAccess]);

  const target = users.find((u) => u.id === targetId)!;

  const has = (mid: string, a: Action) => (draft[mid] ?? []).includes(a);

  const toggle = (mid: string, a: Action) =>
    setDraft((d) => {
      const set = new Set(d[mid] ?? []);
      if (set.has(a)) {
        set.delete(a);
        if (a === 'view') set.clear(); // no view ⇒ no access at all
      } else {
        set.add(a);
        if (a !== 'view') set.add('view'); // any right implies view
      }
      const arr = ACTIONS.filter((x) => set.has(x));
      const next = { ...d };
      if (arr.length) next[mid] = arr;
      else delete next[mid];
      return next;
    });

  const setPreset = (mid: string, value: Role | 'none') =>
    setDraft((d) => {
      const next = { ...d };
      if (value === 'none') delete next[mid];
      else next[mid] = rolePreset(value);
      return next;
    });

  const save = () => { setUserGrants(targetId, draft); ui.toast(`Rights saved for ${target.displayName}`, 'bg-green-700'); };
  const reset = () => ui.confirm('Reset all rights?', 'Restores every user to their default (directory-derived) rights.', () => { resetGrants(); setDraft(getUserAccess(targetId)); ui.toast('Rights reset to defaults', 'bg-green-700'); });

  const summary = useMemo(() => Object.keys(draft).length, [draft]);

  return (
    <div className="section-card">
      <div className="px-5 py-3 border-b bg-gray-50 flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Access Control</h2>
          <p className="text-xs text-gray-500 mt-0.5">Per-module rights · demo enforces <b>View</b> in the menu (server enforces all after migration).</p>
        </div>
        <div className="flex-1" />
        <label className="text-xs font-semibold text-gray-600">User</label>
        <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          {users.map((u) => <option key={u.id} value={u.id}>{u.displayName} — {u.title}</option>)}
        </select>
        <button onClick={save} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold shadow">Save</button>
        <button onClick={reset} className="btn-neutral bg-white border px-3 py-2 rounded text-sm">Reset all</button>
      </div>

      <div className="px-5 py-2 text-xs" style={{ color: 'var(--text3)' }}>
        {target.displayName} has access to <b>{summary}</b> of {RIGHT_MODULES.length} modules.
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className={`${th} text-left`}>Module</th>
              {ACTIONS.map((a) => <th key={a} className={`${th} text-center`}>{ACTION_LABELS[a]}</th>)}
              <th className={`${th} text-left`}>Quick set</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {RIGHT_MODULES.map((m) => (
              <tr key={m.id} className="risk-row">
                <td className="px-3 py-2">
                  <div className="font-medium text-gray-800">{m.label}</div>
                  <div className="text-[11px]" style={{ color: 'var(--text3)' }}>{m.group}</div>
                </td>
                {ACTIONS.map((a) => (
                  <td key={a} className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-[var(--accent)] cursor-pointer"
                      checked={has(m.id, a)}
                      onChange={() => toggle(m.id, a)}
                      aria-label={`${ACTION_LABELS[a]} ${m.label}`}
                    />
                  </td>
                ))}
                <td className="px-3 py-2">
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value) setPreset(m.id, e.target.value as Role | 'none'); }}
                    className="border rounded px-2 py-1 text-xs"
                  >
                    <option value="">Set…</option>
                    {PRESET_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
type Tab = 'profile' | 'users' | 'access';

export function SettingsPage() {
  const { canManageRights } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');

  const tabBtn = (id: Tab, label: string) => (
    <button
      onClick={() => setTab(id)}
      className="px-4 py-2 text-sm font-semibold border-b-2"
      style={{
        color: tab === id ? 'var(--accent)' : 'var(--text3)',
        borderColor: tab === id ? 'var(--accent)' : 'transparent',
      }}
    >
      {label}
    </button>
  );

  // Non-admins only ever see their profile.
  const active: Tab = !canManageRights ? 'profile' : tab;

  return (
    <>
      <PageHeader />
      <div className="p-6 space-y-4">
        <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
          {tabBtn('profile', 'Profile')}
          {canManageRights && tabBtn('users', 'Users')}
          {canManageRights && tabBtn('access', 'Access Control')}
        </div>
        {active === 'profile' && <ProfileTab />}
        {active === 'users' && <UsersTab />}
        {active === 'access' && <AccessTab />}
      </div>
    </>
  );
}
