import { chromium, Browser, Page } from 'playwright-core';
import logger from '../../config/logger';
import type { Journey, JourneyStep, GateResult, VibeVerificationResult } from './types';

const STEP_TIMEOUT_MS = 8_000;
const DEFAULT_TOTAL_BUDGET_MS = 60_000;
const SCREENSHOT_VIEWPORT = { width: 1024, height: 640 };

/**
 * Chromium executable path for THIS process. Left undefined in production so
 * Playwright resolves its own managed browser (installed at deploy time via
 * `npx playwright install chromium` — playwright-core ships no browser of its
 * own on purpose, so a real deployment must run that once). Set
 * PLAYWRIGHT_CHROMIUM_PATH to point at a pre-installed binary in
 * environments (like this dev sandbox) that already have one. Read lazily
 * (not as a module-load-time const) so tests that set this env var after
 * importing this module — imports are hoisted above other top-level code —
 * still take effect.
 */
function chromiumExecutablePath(): string | undefined {
  return process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
}

export class SubmissionUrlError extends Error {}

/**
 * Reject submissions that would make our server fetch something other than
 * an ordinary public web page: non-http(s) schemes, loopback/link-local/
 * private-range hosts, and other addresses that only make sense as an
 * internal target. This is a best-effort SSRF guard — it protects against
 * the obvious literal cases (submitting http://localhost, http://127.0.0.1,
 * http://169.254.169.254 for cloud metadata, RFC1918 ranges, etc.) using the
 * literal host the learner typed; it does not resolve DNS to catch a public
 * hostname that itself resolves to a private IP.
 */
export function validateSubmissionUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SubmissionUrlError('Enter a valid URL, e.g. https://your-app.vercel.app');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SubmissionUrlError('URL must start with http:// or https://');
  }

  const hostname = url.hostname.toLowerCase();
  const blockedExact = new Set(['localhost', '0.0.0.0', '::1', 'metadata.google.internal']);
  if (blockedExact.has(hostname)) {
    throw new SubmissionUrlError('That URL points at a local/internal address — submit your public deployment URL.');
  }
  if (hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new SubmissionUrlError('That URL points at a local/internal address — submit your public deployment URL.');
  }

  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [a, b] = [Number(ipv4Match[1]), Number(ipv4Match[2])];
    const isPrivate =
      a === 127 || // loopback
      a === 10 || // 10.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
      (a === 192 && b === 168) || // 192.168.0.0/16
      (a === 169 && b === 254) || // link-local / cloud metadata
      a === 0;
    if (isPrivate) {
      throw new SubmissionUrlError('That URL points at a private/internal IP address — submit your public deployment URL.');
    }
  }

  return url;
}

function resolveTarget(baseUrl: URL, target: string | undefined): string {
  if (!target) return baseUrl.toString();
  try {
    return new URL(target, baseUrl).toString();
  } catch {
    return target;
  }
}

async function runStep(page: Page, step: JourneyStep, baseUrl: URL): Promise<void> {
  switch (step.action) {
    case 'goto': {
      const dest = resolveTarget(baseUrl, step.target);
      await page.goto(dest, { timeout: STEP_TIMEOUT_MS, waitUntil: 'domcontentloaded' });
      return;
    }
    case 'click': {
      if (!step.target) throw new Error('click step is missing a target selector');
      await page.locator(step.target).first().click({ timeout: STEP_TIMEOUT_MS });
      return;
    }
    case 'fill': {
      if (!step.target) throw new Error('fill step is missing a target selector');
      await page.locator(step.target).first().fill(step.value ?? '', { timeout: STEP_TIMEOUT_MS });
      return;
    }
    case 'expect_visible': {
      if (!step.target) throw new Error('expect_visible step is missing a target selector');
      await page.locator(step.target).first().waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS });
      return;
    }
    case 'expect_hidden': {
      if (!step.target) throw new Error('expect_hidden step is missing a target selector');
      await page.locator(step.target).first().waitFor({ state: 'hidden', timeout: STEP_TIMEOUT_MS });
      return;
    }
    case 'reload': {
      await page.reload({ timeout: STEP_TIMEOUT_MS, waitUntil: 'domcontentloaded' });
      return;
    }
    case 'wait': {
      if (step.target) {
        await page.locator(step.target).first().waitFor({ state: 'attached', timeout: STEP_TIMEOUT_MS });
      } else {
        const ms = Math.min(Math.max(Number(step.value) || 1000, 0), STEP_TIMEOUT_MS);
        await page.waitForTimeout(ms);
      }
      return;
    }
    case 'screenshot': {
      // Purely documentary — capturing happens on the caller side after each
      // step; this action just needs to not throw.
      return;
    }
    default:
      throw new Error(`Unknown journey step action: ${(step as { action?: string }).action}`);
  }
}

async function captureScreenshot(page: Page): Promise<string | null> {
  try {
    const buf = await page.screenshot({ type: 'jpeg', quality: 60, timeout: 5_000 });
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

async function runJourney(browser: Browser, journey: Journey, baseUrl: URL): Promise<GateResult> {
  const steps = journey.steps || [];
  const context = await browser.newContext({ viewport: SCREENSHOT_VIEWPORT });
  const page = await context.newPage();
  let stepsPassed = 0;
  let failureStep: string | undefined;
  let failureReason: string | undefined;
  let screenshotUrl: string | null = null;

  try {
    for (const step of steps) {
      try {
        await runStep(page, step, baseUrl);
        stepsPassed += 1;
      } catch (err) {
        failureStep = step.label || `${step.action} ${step.target || ''}`.trim();
        failureReason = err instanceof Error ? err.message.split('\n')[0] : String(err);
        screenshotUrl = await captureScreenshot(page);
        break;
      }
    }
  } finally {
    await context.close().catch(() => {});
  }

  const passed = steps.length > 0 && stepsPassed === steps.length;
  return {
    journeyId: journey.id,
    label: journey.label,
    passed,
    steps_passed: stepsPassed,
    steps_total: steps.length,
    failure_step: passed ? undefined : failureStep,
    failure_reason: passed ? undefined : (failureReason || 'Journey has no steps configured'),
    screenshot_url: screenshotUrl,
  };
}

/**
 * Run every journey in an acceptance contract against a live, publicly
 * reachable deployment URL using a real headless browser. Journeys run
 * sequentially in fresh browser contexts (so one journey's state — cookies,
 * localStorage, a logged-in session — never leaks into the next) inside a
 * single browser process for speed.
 */
export async function runVibeVerification(params: {
  journeys: Journey[];
  submissionRef: string;
  totalBudgetMs?: number;
}): Promise<VibeVerificationResult> {
  const baseUrl = validateSubmissionUrl(params.submissionRef);
  return runVibeVerificationAgainstUrl({ ...params, baseUrl });
}

/**
 * Same as {@link runVibeVerification} but takes an already-validated URL,
 * skipping the SSRF guard. Exists so tests can drive the browser logic
 * against a local test server without weakening the guard the real entry
 * point enforces — never call this directly with a caller-supplied string.
 */
export async function runVibeVerificationAgainstUrl(params: {
  journeys: Journey[];
  baseUrl: URL;
  submissionRef: string;
  totalBudgetMs?: number;
}): Promise<VibeVerificationResult> {
  const startedAt = Date.now();
  const { baseUrl } = params;
  const budget = params.totalBudgetMs ?? DEFAULT_TOTAL_BUDGET_MS;
  const journeys = params.journeys || [];

  if (journeys.length === 0) {
    return {
      verdict: 'failed',
      gates_passed: 0,
      gates_total: 0,
      score_pct: 0,
      gate_results: [],
      logs_tail: '[vibe] This stage has no journeys configured in its acceptance contract.',
      duration_ms: Date.now() - startedAt,
      submission_source: 'live_url',
      submission_ref: params.submissionRef,
    };
  }

  let browser: Browser | null = null;
  const gateResults: GateResult[] = [];
  const logLines: string[] = [`[vibe] Verifying ${baseUrl.toString()} against ${journeys.length} journey(s).`];

  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: chromiumExecutablePath(),
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });

    for (const journey of journeys) {
      if (Date.now() - startedAt > budget) {
        gateResults.push({
          journeyId: journey.id,
          label: journey.label,
          passed: false,
          steps_passed: 0,
          steps_total: (journey.steps || []).length,
          failure_step: undefined,
          failure_reason: 'Verification time budget exceeded before this journey could run.',
          screenshot_url: null,
        });
        logLines.push(`[vibe] ⏭ ${journey.label}: skipped (time budget exceeded)`);
        continue;
      }

      const result = await runJourney(browser, journey, baseUrl);
      gateResults.push(result);
      logLines.push(
        result.passed
          ? `[vibe] ✓ ${journey.label} (${result.steps_passed}/${result.steps_total} steps)`
          : `[vibe] ✗ ${journey.label}: ${result.failure_reason} (at "${result.failure_step}")`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Vibe verification browser error', err);
    logLines.push(`[vibe] Browser error: ${message}`);
    // Any journeys we didn't get to are recorded as not-run failures so the
    // gate counts stay consistent with journeys.length.
    for (const journey of journeys.slice(gateResults.length)) {
      gateResults.push({
        journeyId: journey.id,
        label: journey.label,
        passed: false,
        steps_passed: 0,
        steps_total: (journey.steps || []).length,
        failure_reason: `Verification could not run: ${message}`,
        screenshot_url: null,
      });
    }
  } finally {
    await browser?.close().catch(() => {});
  }

  const gatesPassed = gateResults.filter((g) => g.passed).length;
  const gatesTotal = gateResults.length;
  const scorePct = gatesTotal > 0 ? Math.round((gatesPassed / gatesTotal) * 100) : 0;
  const verdict: VibeVerificationResult['verdict'] =
    gatesPassed === gatesTotal && gatesTotal > 0 ? 'passed' : gatesPassed > 0 ? 'partial' : 'failed';

  return {
    verdict,
    gates_passed: gatesPassed,
    gates_total: gatesTotal,
    score_pct: scorePct,
    gate_results: gateResults,
    logs_tail: logLines.join('\n'),
    duration_ms: Date.now() - startedAt,
    submission_source: 'live_url',
    submission_ref: params.submissionRef,
  };
}
