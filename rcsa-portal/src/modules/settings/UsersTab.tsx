import { useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../../components/common/Modal';
import { Pill } from '../../components/common/Pill';
import { useUi } from '../../components/common/UiProvider';
import { useAuth, type UserInput } from '../../auth/AuthProvider';
import { userStore } from '../../auth/userStore';
import {
  PASSWORD_RULES,
  passwordIssues,
  usernameIssues,
  isUsernameValid,
} from '../../auth/passwordPolicy';
import type { AppUser, Role } from '../../auth/types';

const th = 'text-left px-4 py-3 text-[10.5px] font-semibold tracking-wide uppercase';
const ROLE_OPTIONS: { value: Role | 'none'; label: string }[] = [
  { value: 'none', label: 'No baseline access' },
  { value: 'viewer', label: 'Viewer (all modules)' },
  { value: 'editor', label: 'Editor (all modules)' },
  { value: 'admin', label: 'Administrator (all modules)' },
];

// ── Create / edit modal ─────────────────────────────────────────────────────────
function UserModal({ user, onClose }: { user: AppUser | 'new'; onClose: () => void }) {
  const ui = useUi();
  const { createUser, updateUser, setUserPassword } = useAuth();
  const e = user === 'new' ? null : user;

  const [displayName, setDisplayName] = useState(e?.displayName ?? '');
  const [username, setUsername] = useState(e?.sAMAccountName ?? '');
  const [email, setEmail] = useState(e?.email ?? '');
  const [title, setTitle] = useState(e?.title ?? '');
  const [groups, setGroups] = useState((e?.groups ?? []).join(', '));
  const [role, setRole] = useState<Role | 'none'>(e?.defaultRole ?? 'viewer');
  const [isAdmin, setIsAdmin] = useState(e?.isAdmin ?? false);
  const [password, setPassword] = useState('');

  const pwIssues = passwordIssues(password, username);
  const showPwChecklist = password.length > 0 || !e; // always for new users

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!displayName.trim()) { ui.toast('Enter a display name.', 'bg-orange-600'); return; }
    if (!isUsernameValid(username)) { ui.toast(`Username: ${usernameIssues(username).join('; ')}`, 'bg-orange-600'); return; }
    if (userStore.loginTaken(username, e?.id)) { ui.toast('That username is already taken.', 'bg-orange-600'); return; }
    // Password: required for new users; optional (only if typed) when editing.
    const needsPw = !e || password.length > 0;
    if (needsPw && pwIssues.length > 0) { ui.toast('Password does not meet the policy.', 'bg-orange-600'); return; }

    const input: UserInput = {
      displayName: displayName.trim(),
      sAMAccountName: username.trim(),
      email: email.trim(),
      title: title.trim(),
      groups: groups.split(/[,;]/).map((g) => g.trim()).filter(Boolean),
      defaultRole: role === 'none' ? null : role,
      isAdmin,
    };

    if (e) {
      updateUser(e.id, input);
      if (password.length > 0) setUserPassword(e.id, password);
      ui.toast('User updated', 'bg-green-700');
    } else {
      // create then set initial password is handled inside createUser
      createUser(input, password);
      ui.toast('User created', 'bg-green-700');
    }
    onClose();
  }

  const field = 'w-full border rounded px-3 py-2 text-sm';
  const lbl = 'text-xs font-semibold text-gray-600 block mb-1';

  return (
    <Modal open onClose={onClose} title={e ? `Edit User — ${e.displayName}` : 'New User'} subtitle="Local account (demo)" maxWidth="max-w-lg">
      <form onSubmit={submit} className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block"><span className={lbl}>Display name *</span><input value={displayName} onChange={(ev) => setDisplayName(ev.target.value)} className={field} placeholder="e.g. Data Otarashvili" /></label>
          <label className="block"><span className={lbl}>Username *</span><input value={username} onChange={(ev) => setUsername(ev.target.value)} className={field} placeholder="e.g. dotarashvili" /></label>
          <label className="block"><span className={lbl}>Title</span><input value={title} onChange={(ev) => setTitle(ev.target.value)} className={field} placeholder="Job title" /></label>
          <label className="block"><span className={lbl}>Email</span><input value={email} onChange={(ev) => setEmail(ev.target.value)} className={field} placeholder="name@lb.ge" /></label>
        </div>
        <label className="block"><span className={lbl}>Directory groups</span><input value={groups} onChange={(ev) => setGroups(ev.target.value)} className={field} placeholder="GRC-Editors, Risk-Contributors" /></label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className={lbl}>Baseline role</span>
            <select value={role} onChange={(ev) => setRole(ev.target.value as Role | 'none')} className={field}>
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm pb-2" style={{ color: 'var(--text2)' }}>
              <input type="checkbox" className="w-4 h-4 accent-[var(--accent)]" checked={isAdmin} onChange={(ev) => setIsAdmin(ev.target.checked)} />
              Can administer access &amp; users
            </label>
          </div>
        </div>

        <label className="block">
          <span className={lbl}>{e ? 'New password (leave blank to keep current)' : 'Password *'}</span>
          <input type="password" value={password} onChange={(ev) => setPassword(ev.target.value)} className={field} placeholder="••••••••••••" />
          {showPwChecklist && (
            <ul className="mt-2 space-y-0.5">
              {PASSWORD_RULES.map((r) => {
                const ok = r.test(password, username);
                return (
                  <li key={r.id} className="text-[11.5px] flex items-center gap-1.5" style={{ color: ok ? 'var(--low)' : 'var(--text3)' }}>
                    <span>{ok ? '✓' : '○'}</span>{r.label}
                  </li>
                );
              })}
            </ul>
          )}
        </label>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold">{e ? 'Save User' : 'Create User'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Tab ─────────────────────────────────────────────────────────────────────────
export function UsersTab() {
  const ui = useUi();
  const { users, setUserActive } = useAuth();
  const [editing, setEditing] = useState<AppUser | 'new' | null>(null);

  const sorted = useMemo(() => [...users].sort((a, b) => a.displayName.localeCompare(b.displayName)), [users]);

  const toggleActive = (u: AppUser) => {
    if (u.active) ui.confirm(`Disable ${u.displayName}?`, 'They will be signed out and can no longer log in (leaver handling).', () => { setUserActive(u.id, false); ui.toast('User disabled', 'bg-red-700'); });
    else { setUserActive(u.id, true); ui.toast('User enabled', 'bg-green-700'); }
  };

  return (
    <div className="section-card">
      <div className="px-5 py-3 border-b bg-gray-50 flex items-center gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Users</h2>
          <p className="text-xs text-gray-500 mt-0.5">Local accounts (demo). In production, users sync from Active Directory.</p>
        </div>
        <div className="flex-1" />
        <button onClick={() => setEditing('new')} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold shadow">+ New User</button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className={th}>Name</th>
              <th className={th}>Username</th>
              <th className={th}>Title</th>
              <th className={th}>Groups</th>
              <th className={th}>Status</th>
              <th className={th}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((u) => (
              <tr key={u.id} className="risk-row">
                <td className="px-4 py-3 font-medium text-gray-800">{u.displayName}{u.isAdmin && <span className="ml-2"><Pill text="Admin" k="info" /></span>}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{u.sAMAccountName}</td>
                <td className="px-4 py-3 text-gray-500">{u.title}</td>
                <td className="px-4 py-3 text-[11px]" style={{ color: 'var(--text3)' }}>{u.groups.join(', ') || '—'}</td>
                <td className="px-4 py-3"><Pill text={u.active ? 'Active' : 'Disabled'} k={u.active ? 'low' : 'mut'} /></td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => setEditing(u)} className="text-blue-600 hover:underline">Edit</button>
                    <button onClick={() => toggleActive(u)} className="hover:underline" style={{ color: u.active ? 'var(--crit)' : 'var(--low)' }}>{u.active ? 'Disable' : 'Enable'}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <UserModal user={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
