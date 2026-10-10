/**
 * API keys and other secrets kept in system_settings (AI provider keys today).
 * The admin never receives them back: reads show a mask with the last four
 * characters, and saving the mask unchanged leaves the stored key alone.
 */

const SECRET_KEY = /(^ai_.*_key$|_secret$|_token$|_api_key$|password)/;
export const MASK = '••••••••';

export const isSecretKey = (key: string) => SECRET_KEY.test(key);

export function maskSecret(value: unknown): string {
    if (typeof value !== 'string' || !value) return '';
    return value.length > 8 ? `${MASK}${value.slice(-4)}` : MASK;
}

/** True for a value the admin got back from us (so: unchanged). */
export const isMasked = (value: unknown) => typeof value === 'string' && value.startsWith(MASK);

/** A settings map safe to send to the admin. */
export function maskSettings(settings: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(settings).map(([k, v]) => [k, isSecretKey(k) ? maskSecret(v) : v]));
}

/** Where each AI provider's key comes from, without the key. */
export function keyStatus(stored: unknown, envValue: string | undefined) {
    const s = typeof stored === 'string' ? stored : '';
    return s ? { configured: true, source: 'admin' as const, hint: maskSecret(s) }
        : envValue ? { configured: true, source: 'server' as const, hint: maskSecret(envValue) }
        : { configured: false, source: null, hint: '' };
}
