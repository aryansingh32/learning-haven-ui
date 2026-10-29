// Runs every drafted problem's Python reference through the real judge (development runner)
// and confirms (1) it is Accepted on every test and (2) an empty solution is NOT.
//   node content/drafts/verify_problems.mjs [slug-filter]
import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire(new URL('../../packages/judge/package.json', import.meta.url));
const { judgeSolution } = require('./dist/index.js');
const problems = JSON.parse(readFileSync(new URL('./out/problems.json', import.meta.url)));
const filter = process.argv[2];
let bad = 0;
for (const p of problems.filter((p) => !filter || p.slug.includes(filter))) {
  const tests = p.tests.map((t) => ({ input: t.input, expected: t.expected, isSample: t.sample }));
  const req = { language: 'python', tests, compare: p.compare, hint: p.name };
  const ok = await judgeSolution({ ...req, code: p.reference_python }, { environment: 'test' });
  const stub = await judgeSolution({ ...req, code: p.starter_code.python }, { environment: 'test' });
  const good = ok.verdict === 'Accepted' && ok.passed === tests.length && stub.verdict !== 'Accepted';
  if (!good) { bad++; console.log('FAIL', p.slug, ok.verdict, `${ok.passed}/${tests.length}`, 'stub:', stub.verdict, ok.message || ''); }
  else console.log('ok  ', p.slug, `${tests.length} tests`);
}
console.log(bad ? `${bad} FAILED` : 'ALL VERIFIED');
process.exit(bad ? 1 : 0);
