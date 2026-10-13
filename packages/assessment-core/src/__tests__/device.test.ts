import { classifyEvent, DEFAULT_PROCTORING, countsAsLeave } from '../proctoring';
import { describeDevice, deviceIdOf, deviceInfoOf, parseUserAgent } from '../device';

const CHROME_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const EDGE_WIN = CHROME_WIN + ' Edg/129.0.2792.65';
const SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const FIREFOX_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:130.0) Gecko/20100101 Firefox/130.0';

describe('parseUserAgent', () => {
  it('reads OS, browser and device type', () => {
    expect(parseUserAgent(CHROME_WIN)).toEqual({ os: 'Windows', osVersion: '10/11', browser: 'Chrome', browserVersion: '129', deviceType: 'desktop' });
    expect(parseUserAgent(EDGE_WIN)).toMatchObject({ browser: 'Edge', browserVersion: '129' });
    expect(parseUserAgent(SAFARI_IPHONE)).toMatchObject({ os: 'iOS', osVersion: '17.5', browser: 'Safari', deviceType: 'mobile' });
    expect(parseUserAgent(ANDROID_TABLET)).toMatchObject({ os: 'Android', osVersion: '14', deviceType: 'tablet' });
    expect(parseUserAgent(FIREFOX_MAC)).toMatchObject({ os: 'macOS', browser: 'Firefox', browserVersion: '130' });
    expect(parseUserAgent('')).toMatchObject({ os: null, browser: null, deviceType: null });
  });
});

describe('deviceInfoOf', () => {
  it('merges browser-reported traits, clipping and dropping junk', () => {
    const d = deviceInfoOf(JSON.stringify({ platform: 'Windows', screen: '1920x1080', screens: 2, timezone: 'Asia/Kolkata', language: 'en-IN', evil: 'x' }), CHROME_WIN);
    expect(d).toMatchObject({ os: 'Windows', screen: '1920x1080', screens: 2, timezone: 'Asia/Kolkata', language: 'en-IN', browser: 'Chrome' });
    expect(d).not.toHaveProperty('evil');
    expect(deviceInfoOf('{not json', CHROME_WIN).screen).toBeNull();
    expect(deviceInfoOf(JSON.stringify({ screen: '<script>', screens: 99 }), CHROME_WIN)).toMatchObject({ screen: null, screens: null });
  });
  it('accepts only real device ids', () => {
    expect(deviceIdOf('a'.repeat(64))).toBe('a'.repeat(64));
    expect(deviceIdOf('not-an-id')).toBeNull();
    expect(deviceIdOf(42)).toBeNull();
  });
  it('describes a device in one line', () => {
    expect(describeDevice(parseUserAgent(CHROME_WIN))).toBe('Chrome 129 · Windows 10/11 · desktop');
    expect(describeDevice(null)).toBe('Unknown device');
  });
});

describe('integrity events', () => {
  it('a device change is always a violation, even when warning first', () => {
    expect(classifyEvent('device_change', 0, DEFAULT_PROCTORING)).toBe('violation');
  });
  it('other new signals are noted as warnings and are not "leaving the exam"', () => {
    for (const t of ['multiple_screens', 'devtools_open', 'screenshot_key', 'large_paste'] as const) {
      expect(classifyEvent(t, 5, DEFAULT_PROCTORING)).toBe('warning');
      expect(countsAsLeave(t)).toBe(false);
    }
    expect(countsAsLeave('tab_switch')).toBe(true);
  });
});
