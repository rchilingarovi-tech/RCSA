// One-shot navigation intent (e.g. Dashboard "Quick Action" → open the New form
// on the target page). sessionStorage so it never outlives the browser tab.
const KEY = 'infosec.nav.intent';

export function setIntent(value: string): void {
  try {
    sessionStorage.setItem(KEY, value);
  } catch {
    /* storage unavailable — quick action degrades to plain navigation */
  }
}

/** Consume the intent if it matches; returns whether it fired. */
export function takeIntent(value: string): boolean {
  try {
    if (sessionStorage.getItem(KEY) === value) {
      sessionStorage.removeItem(KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
