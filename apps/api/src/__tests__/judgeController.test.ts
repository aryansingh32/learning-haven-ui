/**
 * Judge endpoint rules: who may submit, when a solve and XP are recorded, and
 * that the old "trust the browser" submit can't be used on judged problems.
 * Services that touch the database are mocked; the judge runs real code.
 */
jest.mock('../modules/learning/services/problems.service', () => ({
  ProblemsService: { getJudgeData: jest.fn(), invalidateProblemCache: jest.fn() },
}));
jest.mock('../modules/learning/services/submissions.service', () => ({
  SubmissionsService: { submitSolution: jest.fn() },
}));
jest.mock('../modules/learning/services/status.service', () => ({
  StatusService: { updateStatus: jest.fn(), getStatus: jest.fn() },
}));
jest.mock('../modules/entitlements/entitlements.repository', () => ({
  EntitlementsRepository: { getUserPlanAndEntitlements: jest.fn() },
}));

import { JudgeController } from '../modules/learning/controllers/judge.controller';
import { SubmissionsController } from '../modules/learning/controllers/submissions.controller';
import { ProblemsService } from '../modules/learning/services/problems.service';
import { SubmissionsService } from '../modules/learning/services/submissions.service';
import { StatusService } from '../modules/learning/services/status.service';
import { EntitlementsRepository } from '../modules/entitlements/entitlements.repository';

const mocked = <T>(fn: T) => fn as unknown as jest.Mock;

function call(handler: (req: any, res: any) => Promise<unknown>, body: unknown, id = 'p1') {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  return handler({ params: { id }, body, user: { id: 'u1' } }, res).then(() => res);
}

const containsDuplicate = {
  problem: {
    id: 'p1', slug: 'contains-duplicate', is_premium: false,
    starter_code: { javascript: 'function containsDuplicate(nums) {}' }, judge_config: { compare: 'exact' },
  },
  tests: [
    { input: 'nums = [1,2,3,1]', expected_output: 'true', is_sample: true },
    { input: 'nums = [7]', expected_output: 'false', is_sample: false },
  ],
};
const CORRECT = 'function containsDuplicate(nums) { return new Set(nums).size !== nums.length; }';

beforeEach(() => {
  jest.clearAllMocks();
  mocked(ProblemsService.getJudgeData).mockResolvedValue(containsDuplicate);
  mocked(EntitlementsRepository.getUserPlanAndEntitlements).mockResolvedValue({ planSlug: 'free' });
  mocked(SubmissionsService.submitSolution).mockResolvedValue({ xp_gained: 10, is_first_solve: true });
  mocked(StatusService.getStatus).mockResolvedValue(null);
});

describe('POST /problems/:id/judge', () => {
  jest.setTimeout(30_000);

  it('records the solve and XP only when every test passes', async () => {
    const res = await call(JudgeController.judge, { code: CORRECT, language: 'javascript' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ verdict: 'Accepted', passed: 2, total: 2, xpGained: 10, firstSolve: true });
    expect(SubmissionsService.submitSolution).toHaveBeenCalledWith('u1', 'p1', CORRECT, 'javascript');
    expect(StatusService.updateStatus).toHaveBeenCalledWith('u1', 'p1', 'solved');
  });

  it('gives no XP for a wrong answer and only marks it tried', async () => {
    const res = await call(JudgeController.judge, { code: 'function containsDuplicate() { return true; }', language: 'javascript' });
    expect(res.body).toMatchObject({ verdict: 'Wrong Answer', passed: 1, xpGained: 0 });
    expect(SubmissionsService.submitSolution).not.toHaveBeenCalled();
    expect(StatusService.updateStatus).toHaveBeenCalledWith('u1', 'p1', 'tried');
  });

  it('never downgrades a solved or revision status after a failed retry', async () => {
    mocked(StatusService.getStatus).mockResolvedValue({ status: 'revision' });
    await call(JudgeController.judge, { code: 'function containsDuplicate() { return true; }', language: 'javascript' });
    expect(StatusService.updateStatus).not.toHaveBeenCalled();
  });

  it('keeps premium problems for paid plans', async () => {
    mocked(ProblemsService.getJudgeData).mockResolvedValue({ ...containsDuplicate, problem: { ...containsDuplicate.problem, is_premium: true } });
    const free = await call(JudgeController.judge, { code: CORRECT, language: 'javascript' });
    expect(free.statusCode).toBe(403);
    mocked(EntitlementsRepository.getUserPlanAndEntitlements).mockResolvedValue({ planSlug: 'pro' });
    expect((await call(JudgeController.judge, { code: CORRECT, language: 'javascript' })).statusCode).toBe(200);
  });

  it('refuses problems without tests, unknown problems and bad input', async () => {
    mocked(ProblemsService.getJudgeData).mockResolvedValueOnce({ ...containsDuplicate, tests: [] });
    expect((await call(JudgeController.judge, { code: CORRECT, language: 'javascript' })).statusCode).toBe(409);
    mocked(ProblemsService.getJudgeData).mockResolvedValueOnce(null);
    expect((await call(JudgeController.judge, { code: CORRECT, language: 'javascript' })).statusCode).toBe(404);
    expect((await call(JudgeController.judge, { code: CORRECT, language: 'ruby' })).statusCode).toBe(400);
    expect((await call(JudgeController.judge, { code: '', language: 'javascript' })).statusCode).toBe(400);
  });
});

describe('status and legacy submit', () => {
  it("won't self-report 'solved' on a judged problem, but allows tried/revision", async () => {
    const solved = await call(JudgeController.setStatus, { status: 'solved' });
    expect(solved.statusCode).toBe(409);
    expect((await call(JudgeController.setStatus, { status: 'revision' })).statusCode).toBe(200);
    expect(StatusService.updateStatus).toHaveBeenCalledWith('u1', 'p1', 'revision');
  });

  it('blocks the old browser-trusted submit for problems with tests', async () => {
    const res = await call(SubmissionsController.submitSolution, { code: CORRECT, language: 'javascript' });
    expect(res.statusCode).toBe(409);
    expect(SubmissionsService.submitSolution).not.toHaveBeenCalled();
  });
});

describe('POST /problems/:id/run', () => {
  jest.setTimeout(60_000);

  it('runs the sample tests only and records nothing', async () => {
    const res = await call(JudgeController.run, { code: 'function containsDuplicate() { return true; }', language: 'javascript' });
    expect(res.statusCode).toBe(200);
    // Only the sample (which this wrong answer happens to pass) — the hidden test is not run or revealed.
    expect(res.body).toMatchObject({ verdict: 'Accepted', passed: 1, total: 1 });
    expect(JSON.stringify(res.body)).not.toContain('[7]');
    expect(SubmissionsService.submitSolution).not.toHaveBeenCalled();
    expect(StatusService.updateStatus).not.toHaveBeenCalled();
  });

  it('runs C++ on the server', async () => {
    const code = 'class Solution {\npublic:\n    bool containsDuplicate(vector<int>& nums) {\n        return set<int>(nums.begin(), nums.end()).size() != nums.size();\n    }\n};';
    const res = await call(JudgeController.run, { code, language: 'cpp' });
    expect(res.body).toMatchObject({ verdict: 'Accepted', passed: 1, total: 1 });
  });

  it('keeps premium problems for paid plans', async () => {
    mocked(ProblemsService.getJudgeData).mockResolvedValue({ ...containsDuplicate, problem: { ...containsDuplicate.problem, is_premium: true } });
    const res = await call(JudgeController.run, { code: CORRECT, language: 'javascript' });
    expect(res.statusCode).toBe(403);
  });
});
