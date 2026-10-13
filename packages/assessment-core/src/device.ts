// Devices: what the apps send about the browser a learner is on, and how the
// APIs read it. The browser sends a device id (a hash of stable browser and
// hardware traits, see apps/web/src/lib/device.ts) and a few traits; the
// server keeps them with the IP it saw. Used to show staff which devices an
// account uses, and to catch a test continued on another device.

export interface DeviceInfo {
  os: string | null;
  osVersion: string | null;
  browser: string | null;
  browserVersion: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet' | null;
  screen: string | null; // "1920x1080"
  screens: number | null; // >1 when the browser reports an extended display
  timezone: string | null;
  language: string | null;
}

const DEVICE_ID = /^[a-f0-9]{32,64}$/;
/** A device id the browser sent, or null if it isn't one. */
export function deviceIdOf(raw: unknown): string | null {
  return typeof raw === 'string' && DEVICE_ID.test(raw) ? raw : null;
}

const clip = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** Reads the User-Agent: OS, browser and kind of device. */
export function parseUserAgent(ua: string | null | undefined): Pick<DeviceInfo, 'os' | 'osVersion' | 'browser' | 'browserVersion' | 'deviceType'> {
  const s = ua ?? '';
  let os: string | null = null;
  let osVersion: string | null = null;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/Windows NT ([\d.]+)/))) { os = 'Windows'; osVersion = ({ '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7' } as Record<string, string>)[m[1]] ?? m[1]; }
  else if ((m = s.match(/(?:iPhone|iPad|iPod).*? OS ([\d_]+)/))) { os = 'iOS'; osVersion = m[1].replace(/_/g, '.'); }
  else if ((m = s.match(/Android ([\d.]+)/))) { os = 'Android'; osVersion = m[1]; }
  else if (/CrOS/.test(s)) os = 'ChromeOS';
  else if ((m = s.match(/Mac OS X ([\d_.]+)/))) { os = 'macOS'; osVersion = m[1].replace(/_/g, '.'); }
  else if (/Linux/.test(s)) os = 'Linux';

  let browser: string | null = null;
  let browserVersion: string | null = null;
  const pick = (name: string, re: RegExp) => { const r = s.match(re); if (r && !browser) { browser = name; browserVersion = r[1]; } };
  pick('Edge', /Edg(?:e|A|iOS)?\/([\d.]+)/);
  pick('Opera', /OPR\/([\d.]+)/);
  pick('Samsung Internet', /SamsungBrowser\/([\d.]+)/);
  pick('Firefox', /(?:Firefox|FxiOS)\/([\d.]+)/);
  pick('Chrome', /(?:Chrome|CriOS)\/([\d.]+)/);
  pick('Safari', /Version\/([\d.]+).*Safari/);

  const deviceType: DeviceInfo['deviceType'] = !s ? null
    : /iPad|Tablet|Android(?!.*Mobile)/.test(s) ? 'tablet'
    : /Mobi|iPhone|iPod|Android/.test(s) ? 'mobile' : 'desktop';
  return { os, osVersion, browser, browserVersion: browserVersion ? (browserVersion as string).split('.')[0] : null, deviceType };
}

/**
 * Traits the browser reported (X-Device-Info, JSON) merged with the User-Agent.
 * Everything is clipped; unknown fields are dropped.
 */
export function deviceInfoOf(rawInfo: unknown, userAgent: string | null | undefined): DeviceInfo {
  let info: Record<string, unknown> = {};
  if (typeof rawInfo === 'string' && rawInfo.length <= 2048) {
    try { const v = JSON.parse(rawInfo); if (v && typeof v === 'object') info = v as Record<string, unknown>; } catch { /* ignore */ }
  } else if (rawInfo && typeof rawInfo === 'object') info = rawInfo as Record<string, unknown>;
  const ua = parseUserAgent(userAgent);
  const screens = Number(info.screens);
  return {
    ...ua,
    // The browser's own platform report (navigator.userAgentData) beats the UA string when present.
    os: clip(info.platform, 40) ?? ua.os,
    screen: typeof info.screen === 'string' && /^\d{2,5}x\d{2,5}$/.test(info.screen) ? info.screen : null,
    screens: Number.isInteger(screens) && screens > 0 && screens < 10 ? screens : null,
    timezone: clip(info.timezone, 64),
    language: clip(info.language, 35),
  };
}

/** "Chrome 129 · Windows 10/11 · desktop" */
export function describeDevice(d: Partial<DeviceInfo> | null | undefined): string {
  if (!d) return 'Unknown device';
  const browser = [d.browser, d.browserVersion].filter(Boolean).join(' ');
  const os = [d.os, d.osVersion].filter(Boolean).join(' ');
  return [browser, os, d.deviceType].filter(Boolean).join(' · ') || 'Unknown device';
}
