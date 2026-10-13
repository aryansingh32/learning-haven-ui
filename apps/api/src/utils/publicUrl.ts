import { lookup } from 'dns/promises';
import net from 'net';

/**
 * Whether a URL the server is about to fetch (an admin-entered logo, …) points
 * at the public internet: https, and every address its host resolves to is
 * public. Stops server-side request forgery into localhost, the private
 * network or cloud metadata (169.254.169.254).
 */
export function isPrivateAddress(ip: string): boolean {
    const v = ip.replace(/^::ffff:/, '');
    if (net.isIPv4(v)) {
        const [a, b] = v.split('.').map(Number);
        return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
            || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
    }
    const x = v.toLowerCase();
    return x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80') || x.startsWith('ff');
}

export async function isPublicHttpsUrl(raw: string): Promise<boolean> {
    let url: URL;
    try { url = new URL(raw); } catch { return false; }
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false;
    try {
        const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
        return addrs.length > 0 && addrs.every((a) => !isPrivateAddress(a.address));
    } catch {
        return false;
    }
}
