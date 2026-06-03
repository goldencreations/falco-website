/** Default “remember me” for staff login (loan officers work long shifts in the field). */
export const DEFAULT_STAFF_REMEMBER_ME = true;

/** Cookie lifetime when remember-me is off (was 1 day; extended for fewer mid-day logouts). */
export const SESSION_STANDARD_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/** Cookie lifetime when remember-me is on. */
export const SESSION_REMEMBER_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function envMinSessionSeconds(): number | null {
 const raw = process.env.FALCO_SESSION_MIN_AGE_SECONDS?.trim();
 if (!raw) return null;
 const n = Number.parseInt(raw, 10);
 return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Browser cookie `maxAge` for `falco_access_token`.
 * Prefer the API `expires_in` when it is longer; otherwise use staff-friendly floors.
 * Login always sends `rememberMe` to the LMS so `expires_in` is typically extended server-side.
 */
export function resolveSessionMaxAgeSeconds(
 rememberMe: boolean,
 expiresIn?: number
): number {
 const envFloor = envMinSessionSeconds();
 const floor = rememberMe
 ? Math.max(SESSION_REMEMBER_MAX_AGE_SECONDS, envFloor ?? 0)
 : Math.max(SESSION_STANDARD_MAX_AGE_SECONDS, envFloor ?? 0);

 if (typeof expiresIn === "number" && expiresIn > 0) {
 return Math.max(expiresIn, floor);
 }
 return floor;
}

export function staffRememberMeFromLoginBody(rememberMe: boolean | undefined): boolean {
 if (rememberMe === false) return false;
 return DEFAULT_STAFF_REMEMBER_ME;
}
