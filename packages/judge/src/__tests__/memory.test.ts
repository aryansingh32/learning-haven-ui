/**
 * Memory reporting: Judge0's `memory` field (KB) and the local runner's Linux sampling.
 */
import { judge0Memory, judgeSolution, peakKbFromStatus } from '..';

const tests = [{ input: 'n = 3', expected: '3', isSample: true }];

describe('memory used by a run', () => {
  jest.setTimeout(60_000);
  afterEach(() => { jest.restoreAllMocks(); });

  it('reads the peak from /proc status and Judge0 values', () => {
    expect(peakKbFromStatus('Name:\tnode\nVmPeak:\t  900 kB\nVmHWM:\t   41234 kB\nVmRSS:\t 40000 kB\n')).toBe(41234);
    expect(peakKbFromStatus('Name:\tnode\n')).toBeUndefined();
    expect(judge0Memory(3412)).toBe(3412);
    expect(judge0Memory(null)).toBeUndefined();
    expect(judge0Memory(0)).toBeUndefined();
    expect(judge0Memory('12')).toBeUndefined();
  });

  it('passes on the memory Judge0 reports for the run', async () => {
    const urls: string[] = [];
    let source = '';
    jest.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      urls.push(String(url));
      if (init?.method === 'POST') {
        source = Buffer.from(JSON.parse(String(init.body)).source_code, 'base64').toString('utf8');
        return new Response(JSON.stringify({ token: 't1' }), { status: 201 });
      }
      // The harness prints `<marker>O<index>:<value>`; answer like Judge0 would.
      const marker = /__FORGE_[0-9a-f]+__/.exec(source)?.[0] ?? '';
      return new Response(JSON.stringify({
        stdout: Buffer.from(`${marker}O0:3\n`).toString('base64'), stderr: null, compile_output: null, message: null,
        time: '0.012', memory: 7340, status: { id: 3, description: 'Accepted' },
      }), { status: 200 });
    });
    const r = await judgeSolution({ code: 'function f(n) { return n; }', language: 'javascript', tests, compare: 'exact', hint: 'f' },
      { environment: 'production', judge0Url: 'http://judge0.test' });
    expect(r.verdict).toBe('Accepted');
    expect(r.memoryKb).toBe(7340);
    expect(r.timeMs).toBe(12);
    expect(urls.some((u) => /fields=[^&]*memory/.test(u))).toBe(true);
  });

  it('the local runner samples peak memory on Linux', async () => {
    const r = await judgeSolution({
      code: 'function f(n) { const big = new Array(2000000).fill(n); return big.length > 0 ? n : 0; }',
      language: 'javascript', tests, compare: 'exact', hint: 'f',
    }, { environment: 'test' });
    expect(r.verdict).toBe('Accepted');
    if (process.platform === 'linux') expect(r.memoryKb).toBeGreaterThan(10_000);
    else expect(r.memoryKb).toBeUndefined();
  });
});
