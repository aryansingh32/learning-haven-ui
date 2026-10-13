/**
 * This browser's device id and traits, sent with API calls (X-Device-Id,
 * X-Device-Info) so staff can see which devices an account uses and a test
 * can't quietly continue on another device. The id is a SHA-256 of stable
 * browser and hardware traits (not of anything personal); it is cached for the
 * session. Nothing here blocks a request if it fails.
 */

let cached: Promise<{ id: string; info: string } | null> | null = null;

function traits() {
  const n = navigator as Navigator & { deviceMemory?: number; userAgentData?: { platform?: string } };
  let gpu = '';
  try {
    const gl = document.createElement('canvas').getContext('webgl') as WebGLRenderingContext | null;
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    if (gl && ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
  } catch { /* no WebGL */ }
  const screens = (window.screen as Screen & { isExtended?: boolean }).isExtended ? 2 : 1;
  return {
    stable: [n.userAgent, n.language, n.hardwareConcurrency, n.deviceMemory ?? '', screen.width, screen.height, screen.colorDepth,
      window.devicePixelRatio, Intl.DateTimeFormat().resolvedOptions().timeZone, n.maxTouchPoints, gpu].join('|'),
    info: {
      platform: n.userAgentData?.platform || undefined,
      screen: `${screen.width}x${screen.height}`,
      screens,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: n.language,
    },
  };
}

async function sha256(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** { id, info } for the request headers, or null where the browser can't hash (old browsers, insecure origins). */
export function deviceIdentity(): Promise<{ id: string; info: string } | null> {
  cached ??= (async () => {
    try {
      if (!crypto?.subtle) return null;
      const t = traits();
      return { id: await sha256(t.stable), info: JSON.stringify(t.info) };
    } catch {
      return null;
    }
  })();
  return cached;
}

/** Whether the browser reports a second display right now (Chrome, Edge). */
export const hasExtendedDisplay = () => Boolean((window.screen as Screen & { isExtended?: boolean }).isExtended);

/** The device headers for a request ({} if the browser can't compute them). */
export async function deviceHeaders(): Promise<Record<string, string>> {
  const d = await deviceIdentity();
  return d ? { 'X-Device-Id': d.id, 'X-Device-Info': d.info } : {};
}
