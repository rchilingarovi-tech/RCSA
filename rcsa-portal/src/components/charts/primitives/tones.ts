// Shared chart tones → CSS design tokens. Keeping these as tokens (not hex) means
// every migrated dashboard chart adapts to the light/dark theme automatically.
export type Tone = 'crit' | 'high' | 'med' | 'low' | 'info' | 'ok' | 'mut' | 'purple' | 'accent';

export const toneVar = (t: Tone): string => (t === 'accent' ? 'var(--accent)' : `var(--${t})`);
export const toneBg = (t: Tone): string => (t === 'accent' ? 'var(--ok-bg)' : `var(--${t}-bg)`);
