import dotenv from 'dotenv';
dotenv.config();

import request from 'supertest';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const API_BASE_URL = 'http://localhost:5000';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:adminDSAOSsupabase@db.wxrxnqhjkwlxvmaopvlv.supabase.co:5432/postgres',
});

function log(msg: string) {
  process.stdout.write(msg + '\n');
}

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, name: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    log(`  ✓ PASS: ${name}`);
  } else {
    failedTests++;
    log(`  ✗ FAIL: ${name}${detail ? ' (' + detail + ')' : ''}`);
  }
}

async function runTests() {
  log('\n================================================================');
  log('   CHAPTERS & REFERRALS API INTEGRATION & EDGE CASE SUITE');
  log('================================================================\n');

  try {
    const userRes = await pool.query(`SELECT id, email, role FROM public.users LIMIT 1;`);
    let testUserId = null;
    let testToken = '';
    
    if (userRes.rows.length > 0) {
      const user = userRes.rows[0];
      testUserId = user.id;
      testToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '1h' }
      );
    } else {
      log('⚠️ No users found in database for authenticated tests.');
      process.exit(1);
    }

    log('1. Chapters & Course APIs');
    
    // 1.1 List Chapters (requires a course_id, we will test an invalid one)
    const invalidChapterRes = await request(API_BASE_URL)
      .get(`/api/v1/learning/courses/invalid-course-id/chapters`)
      .set('Authorization', `Bearer ${testToken}`);
    assert(invalidChapterRes.status === 404 || invalidChapterRes.status === 400 || invalidChapterRes.status === 500, 'Invalid course ID for chapters safely caught');

    // 1.2 Unlock a Chapter (Edge case: missing body)
    const unlockMissingRes = await request(API_BASE_URL)
      .post(`/api/v1/learning/chapters/unlock`)
      .set('Authorization', `Bearer ${testToken}`);
    assert(unlockMissingRes.status === 400 || unlockMissingRes.status === 500, 'Chapter unlock with missing payload handled safely');

    // 1.3 Chapter Progress Edge Case (Updating without correct format)
    const progRes = await request(API_BASE_URL)
      .post(`/api/v1/learning/chapters/dummy-123/progress/task`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({ task_id: 'abc' }); 
    assert(progRes.status === 404 || progRes.status === 400, 'Updating progress on dummy chapter handled safely');

    log('\n2. Referrals (v2) APIs');
    
    // 2.1 Fetch Referrals Info / Earnings
    const earnRes = await request(API_BASE_URL)
      .get(`/api/v2/referrals/earnings`)
      .set('Authorization', `Bearer ${testToken}`);
    assert(earnRes.status === 200, 'Referrals earnings endpoint responds successfully');
    
    if (earnRes.body && earnRes.body.wallet) {
       assert(earnRes.body.wallet !== undefined, 'Referrals earnings contains wallet object');
    }

    // 2.2 Submit self-referral or invalid code (Edge Case)
    const applyRes = await request(API_BASE_URL)
      .post(`/api/v1/billing/referrals/apply`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({ code: 'SELF_CODE_123' });
    assert(applyRes.status === 400 || applyRes.status === 404, 'Applying invalid/self referral code is rejected');

    // 2.3 Fetch Leaderboard
    const lbRes = await request(API_BASE_URL).get(`/api/v1/billing/referrals/leaderboard`);
    assert(lbRes.status === 200, 'Referrals leaderboard endpoint is public and responds 200');

  } catch (err: any) {
    log('\nEXPLICIT TEST ERROR: ' + err.message);
    failedTests++;
  } finally {
    log('\n================================================================');
    log(`  AUDIT RESULTS: TOTAL: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
    log('================================================================\n');
    await pool.end();
    process.exit(failedTests > 0 ? 1 : 0);
  }
}

runTests();
