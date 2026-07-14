// Environment-specific values in ONE place so a production migration doesn't
// hunt string literals. After migration these come from server config / env.

/** Directory UPN / mail domain appended to usernames created in Settings. */
export const UPN_DOMAIN = 'lb.ge';
