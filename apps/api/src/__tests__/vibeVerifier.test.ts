/**
 * Vibe verification engine tests.
 *
 * These run a REAL headless Chromium against a tiny local HTTP server —
 * no mocking of the browser — to prove the journey/step runner actually
 * drives a page correctly, not just that it calls the right mock functions.
 * If no Chromium binary is available in this environment (CI without a
 * browser installed), the browser-dependent tests skip themselves rather
 * than failing the whole suite.
 */
import http from 'node:http';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import { runVibeVerification, runVibeVerificationAgainstUrl, validateSubmissionUrl, SubmissionUrlError } from '../modules/build-haven/vibeVerifier';
import type { Journey } from '../modules/build-haven/types';

const CHROMIUM_CANDIDATES = [process.env.PLAYWRIGHT_CHROMIUM_PATH, '/opt/pw-browsers/chromium'].filter(
  (p): p is string => Boolean(p)
);
const chromiumPath = CHROMIUM_CANDIDATES.find((p) => fs.existsSync(p));
if (chromiumPath) {
  process.env.PLAYWRIGHT_CHROMIUM_PATH = chromiumPath;
}
const describeIfBrowser = chromiumPath ? describe : describe.skip;

const TEST_PAGE_HTML = `
<!doctype html>
<html>
<body>
  <h1 id="title">Welcome</h1>
  <button id="reveal" onclick="document.getElementById('secret').style.display='block'">Reveal</button>
  <div id="secret" style="display:none">Secret content</div>
  <form onsubmit="event.preventDefault(); document.getElementById('greeting').innerText = 'Hello, ' + document.getElementById('name').value;">
    <input id="name" name="name" />
    <button id="submit-name" type="submit">Say hi</button>
  </form>
  <p id="greeting"></p>
</body>
</html>
`;

function startTestServer(): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(TEST_PAGE_HTML);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}

describe('validateSubmissionUrl', () => {
  it('accepts a normal https URL', () => {
    const url = validateSubmissionUrl('https://my-app.vercel.app/dashboard');
    expect(url.hostname).toBe('my-app.vercel.app');
  });

  it('rejects non-http(s) schemes', () => {
    expect(() => validateSubmissionUrl('file:///etc/passwd')).toThrow(SubmissionUrlError);
    expect(() => validateSubmissionUrl('ftp://example.com')).toThrow(SubmissionUrlError);
  });

  it('rejects malformed URLs', () => {
    expect(() => validateSubmissionUrl('not a url')).toThrow(SubmissionUrlError);
  });

  it('rejects localhost and loopback', () => {
    expect(() => validateSubmissionUrl('http://localhost:3000')).toThrow(SubmissionUrlError);
    expect(() => validateSubmissionUrl('http://127.0.0.1:8080')).toThrow(SubmissionUrlError);
    expect(() => validateSubmissionUrl('http://127.5.5.5')).toThrow(SubmissionUrlError);
  });

  it('rejects private IP ranges', () => {
    expect(() => validateSubmissionUrl('http://10.0.0.5')).toThrow(SubmissionUrlError);
    expect(() => validateSubmissionUrl('http://172.16.0.5')).toThrow(SubmissionUrlError);
    expect(() => validateSubmissionUrl('http://192.168.1.5')).toThrow(SubmissionUrlError);
  });

  it('rejects cloud metadata / link-local addresses', () => {
    expect(() => validateSubmissionUrl('http://169.254.169.254/latest/meta-data')).toThrow(SubmissionUrlError);
  });

  it('rejects .local and .internal hostnames', () => {
    expect(() => validateSubmissionUrl('http://printer.local')).toThrow(SubmissionUrlError);
    expect(() => validateSubmissionUrl('http://db.internal')).toThrow(SubmissionUrlError);
  });

  it('does not reject a public-looking hostname that merely contains a private-range prefix', () => {
    // e.g. a domain like "10.0.0.5.example.com" must not false-positive
    expect(() => validateSubmissionUrl('http://10.0.0.5.example.com')).not.toThrow();
  });
});

describeIfBrowser('runVibeVerification (real browser)', () => {
  let server: { url: string; close: () => Promise<void> };

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  it('passes a journey whose every step succeeds', async () => {
    const journeys: Journey[] = [
      {
        id: 'j1',
        label: 'Reveal secret content',
        public: true,
        steps: [
          { action: 'goto', target: '/' },
          { action: 'expect_visible', target: '#title' },
          { action: 'expect_hidden', target: '#secret' },
          { action: 'click', target: '#reveal' },
          { action: 'expect_visible', target: '#secret' },
        ],
      },
    ];

    const result = await runVibeVerificationAgainstUrl({ journeys, baseUrl: new URL(server.url), submissionRef: server.url });

    expect(result.verdict).toBe('passed');
    expect(result.gates_passed).toBe(1);
    expect(result.gates_total).toBe(1);
    expect(result.score_pct).toBe(100);
    expect(result.gate_results[0].passed).toBe(true);
    expect(result.gate_results[0].steps_passed).toBe(5);
  }, 30_000);

  it('runs a fill + submit journey and asserts the resulting DOM state', async () => {
    const journeys: Journey[] = [
      {
        id: 'j2',
        label: 'Submit the greeting form',
        public: true,
        steps: [
          { action: 'goto', target: '/' },
          { action: 'fill', target: '#name', value: 'Ada' },
          { action: 'click', target: '#submit-name' },
          { action: 'expect_visible', target: 'text=Hello, Ada' },
        ],
      },
    ];

    const result = await runVibeVerificationAgainstUrl({ journeys, baseUrl: new URL(server.url), submissionRef: server.url });

    expect(result.verdict).toBe('passed');
    expect(result.gate_results[0].passed).toBe(true);
  }, 30_000);

  it('fails a journey that asserts something never true, with a screenshot and reason', async () => {
    const journeys: Journey[] = [
      {
        id: 'j3',
        label: 'Looks for an element that does not exist',
        public: true,
        steps: [
          { action: 'goto', target: '/' },
          { action: 'expect_visible', target: '#does-not-exist', label: 'Check missing element' },
        ],
      },
    ];

    const result = await runVibeVerificationAgainstUrl({ journeys, baseUrl: new URL(server.url), submissionRef: server.url });

    expect(result.verdict).toBe('failed');
    expect(result.gates_passed).toBe(0);
    const gate = result.gate_results[0];
    expect(gate.passed).toBe(false);
    expect(gate.steps_passed).toBe(1); // the goto succeeded before the failing step
    expect(gate.failure_step).toBe('Check missing element');
    expect(gate.failure_reason).toBeTruthy();
    expect(gate.screenshot_url).toMatch(/^data:image\/jpeg;base64,/);
  }, 30_000);

  it('reports "partial" verdict when some journeys pass and some fail', async () => {
    const journeys: Journey[] = [
      {
        id: 'pass',
        label: 'Passing journey',
        public: true,
        steps: [{ action: 'goto', target: '/' }, { action: 'expect_visible', target: '#title' }],
      },
      {
        id: 'fail',
        label: 'Failing journey',
        public: true,
        steps: [{ action: 'goto', target: '/' }, { action: 'expect_visible', target: '#nope' }],
      },
    ];

    const result = await runVibeVerificationAgainstUrl({ journeys, baseUrl: new URL(server.url), submissionRef: server.url });

    expect(result.verdict).toBe('partial');
    expect(result.gates_passed).toBe(1);
    expect(result.gates_total).toBe(2);
    expect(result.score_pct).toBe(50);
  }, 30_000);

  it('keeps one journey\'s state isolated from the next (fresh context per journey)', async () => {
    const journeys: Journey[] = [
      {
        id: 'reveal-in-first',
        label: 'Reveal secret in journey 1',
        public: true,
        steps: [
          { action: 'goto', target: '/' },
          { action: 'click', target: '#reveal' },
          { action: 'expect_visible', target: '#secret' },
        ],
      },
      {
        id: 'secret-hidden-again',
        label: 'Secret should be hidden again in a fresh journey',
        public: true,
        steps: [
          { action: 'goto', target: '/' },
          { action: 'expect_hidden', target: '#secret' },
        ],
      },
    ];

    const result = await runVibeVerificationAgainstUrl({ journeys, baseUrl: new URL(server.url), submissionRef: server.url });
    expect(result.verdict).toBe('passed');
    expect(result.gates_passed).toBe(2);
  }, 30_000);

  it('rejects a submission URL pointing at a private address before launching a browser', async () => {
    const journeys: Journey[] = [{ id: 'j', label: 'x', public: true, steps: [{ action: 'goto', target: '/' }] }];
    await expect(runVibeVerification({ journeys, submissionRef: 'http://169.254.169.254' })).rejects.toThrow(
      SubmissionUrlError
    );
  });

  it('returns a clean zero-journey result instead of throwing when the contract has none', async () => {
    const result = await runVibeVerificationAgainstUrl({ journeys: [], baseUrl: new URL(server.url), submissionRef: server.url });
    expect(result.verdict).toBe('failed');
    expect(result.gates_total).toBe(0);
    expect(result.gate_results).toEqual([]);
  });
});
