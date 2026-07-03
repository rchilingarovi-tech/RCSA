import { useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { DEMO_PASSWORD } from '../../auth/seed';

const initials = (name: string) => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

export function LoginPage() {
  const { login, switchUser, users } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) { setError('Enter your username and password.'); return; }
    const res = login(username, password);
    if (!res.ok) setError(res.error ?? 'Sign-in failed.');
  };

  const field = 'w-full border rounded-lg px-3 py-2.5 text-sm';

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <span
            className="w-12 h-12 rounded-[13px] flex items-center justify-center shrink-0 mb-3"
            style={{ background: 'linear-gradient(135deg,#0d9488,#2dd4bf)', color: '#04211d' }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z" /><path d="M9 12l2 2 4-4" />
            </svg>
          </span>
          <div className="text-lg font-bold tracking-tight" style={{ color: 'var(--text)' }}>InfoSec Portal</div>
          <div className="text-[12px]" style={{ color: 'var(--text3)' }}>Sign in to continue</div>
        </div>

        <form onSubmit={submit} className="section-card p-5 space-y-3">
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text2)' }}>Username</label>
            <input value={username} onChange={(e) => { setUsername(e.target.value); setError(''); }} className={field} placeholder="e.g. ngelashvili" autoFocus />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text2)' }}>Password</label>
            <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} className={field} placeholder="••••••••••••" />
          </div>
          {error && <div className="text-xs font-medium" style={{ color: 'var(--crit)' }}>{error}</div>}
          <button type="submit" className="w-full bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-semibold shadow">Sign in</button>
        </form>

        {/* Demo convenience — one-click sign-in for the presentation */}
        <div className="section-card mt-4 overflow-hidden">
          <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-b" style={{ color: 'var(--text3)', borderColor: 'var(--border)' }}>
            Demo accounts · click to sign in
          </div>
          {users.filter((u) => u.active).map((u) => (
            <button
              key={u.id}
              onClick={() => switchUser(u.id)}
              className="w-full text-left px-4 py-2.5 flex items-center gap-2.5 border-t"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0" style={{ background: 'linear-gradient(135deg,#334155,#0f766e)' }}>{initials(u.displayName)}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold truncate" style={{ color: 'var(--text)' }}>{u.displayName}</span>
                <span className="block text-[11px] truncate" style={{ color: 'var(--text3)' }}>{u.sAMAccountName} · {u.title}</span>
              </span>
            </button>
          ))}
          <div className="px-4 py-2 text-[11px] border-t" style={{ color: 'var(--text3)', borderColor: 'var(--border)' }}>
            Or sign in manually — demo password for all accounts: <span className="font-mono font-semibold" style={{ color: 'var(--text2)' }}>{DEMO_PASSWORD}</span>
          </div>
        </div>

        <p className="text-[11px] text-center mt-4" style={{ color: 'var(--text3)' }}>
          Demo authentication — credentials are stored locally. Production authenticates against Active Directory / a server.
        </p>
      </div>
    </div>
  );
}
