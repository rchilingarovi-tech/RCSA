// Password & username minimum standards (Phase 4). The POLICY is real and enforced
// in the UI. The HASHING below is a DEMO placeholder only — production must hash
// server-side with bcrypt/argon2 and never handle raw passwords in the browser.

export interface Rule {
  id: string;
  label: string;
  test: (pw: string, username?: string) => boolean;
}

// Well-known baseline (length + character classes + no-username), aligned with
// common corporate policy.
export const PASSWORD_RULES: Rule[] = [
  { id: 'len', label: 'At least 12 characters', test: (p) => p.length >= 12 },
  { id: 'upper', label: 'An uppercase letter (A–Z)', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'A lowercase letter (a–z)', test: (p) => /[a-z]/.test(p) },
  { id: 'digit', label: 'A number (0–9)', test: (p) => /\d/.test(p) },
  { id: 'symbol', label: 'A symbol (! @ # $ …)', test: (p) => /[^A-Za-z0-9]/.test(p) },
  { id: 'noname', label: 'Does not contain the username', test: (p, u) => !u || u.length < 3 || !p.toLowerCase().includes(u.toLowerCase()) },
];

export function passwordIssues(pw: string, username?: string): string[] {
  return PASSWORD_RULES.filter((r) => !r.test(pw, username)).map((r) => r.label);
}
export function isPasswordValid(pw: string, username?: string): boolean {
  return passwordIssues(pw, username).length === 0;
}

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,}$/;
export function usernameIssues(u: string): string[] {
  const v = u.trim();
  const out: string[] = [];
  if (v.length < 3) out.push('At least 3 characters');
  if (v && !/^[a-zA-Z0-9._-]+$/.test(v)) out.push('Only letters, numbers, dot, underscore, hyphen');
  return out;
}
export function isUsernameValid(u: string): boolean {
  return USERNAME_RE.test(u.trim());
}

// ── DEMO-ONLY hashing ───────────────────────────────────────────────────────────
// FNV-1a — fast, synchronous, NOT cryptographically secure. It exists so the demo
// never stores plaintext passwords. Replace with a server-side bcrypt/argon2 call
// on migration (the verify/seam stays the same).
export function hashPassword(pw: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < pw.length; i++) {
    h ^= pw.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `demo$${(h >>> 0).toString(16).padStart(8, '0')}`;
}
export function verifyPassword(pw: string, hash: string): boolean {
  return hashPassword(pw) === hash;
}
