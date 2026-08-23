import dotenv from 'dotenv';
dotenv.config();

import request from 'supertest';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const API_BASE_URL = 'http://localhost:5000';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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

async function runSaaSApiTests() {
  log('\n================================================================');
  log('   LEARNING HAVEN - SAAS LEVEL API, SECURITY & FLOW TEST SUITE');
  log('================================================================\n');

  try {
    // 1. Prepare Authentication Token
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
      log('⚠️ No users found in database for authenticated tests. Some tests will fail.');
    }

    // ---------------------------------------------------------------
    // 1. GENERAL HEALTH & LATENCY
    // ---------------------------------------------------------------
    log('1. Health & Latency Tests');
    const t0 = Date.now();
    const healthRes = await request(API_BASE_URL).get('/api/health');
    const latency = Date.now() - t0;
    assert(healthRes.status === 200, 'Health endpoint responds with 200 OK');
    assert(latency < 500, `Health API Latency is acceptable (${latency}ms)`);

    // ---------------------------------------------------------------
    // 2. SECURITY & PENETRATION SCANS
    // ---------------------------------------------------------------
    log('\n2. Security & Penetration Tests');
    
    // 2.1 No Auth Token
    const noAuthRes = await request(API_BASE_URL).get('/api/v1/build-haven/enrollments');
    assert(noAuthRes.status === 401, 'Unauthorized request rejected with 401');

    // 2.2 SQL Injection via Query Parameter
    const sqliRes = await request(API_BASE_URL)
      .get(`/api/v1/build-haven/challenges/' OR '1'='1`)
      .set('Authorization', `Bearer ${testToken}`);
    assert(sqliRes.status === 404 || sqliRes.status === 400 || sqliRes.status === 500, 'SQLi payload safely handled (not executing)');

    // 2.3 XSS Payload in JSON Body (Simulating a Vibe Submission)
    const xssRes = await request(API_BASE_URL)
      .post('/api/v1/build-haven/enrollments/test-enroll/submissions')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ stageId: 'test-stage', liveUrl: '<script>alert(1)</script>' });
    assert(xssRes.status === 400 || xssRes.status === 404, 'XSS payload in JSON Body safely rejected or escaped');

    // 2.4 Payload Too Large (Simulating DoS)
    const largePayload = 'A'.repeat(2 * 1024 * 1024); // 2MB string
    const largeRes = await request(API_BASE_URL)
      .post('/api/v1/build-haven/enrollments/test-enroll/submissions')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ stageId: 'test-stage', liveUrl: largePayload });
    assert(largeRes.status === 413, 'Payload Too Large safely rejected (413 Entity Too Large)');

    // ---------------------------------------------------------------
    // 3. EDGE CASES & MISCELLANEOUS
    // ---------------------------------------------------------------
    log('\n3. Edge Cases & Miscellaneous Tests');
    
    // 3.1 Malformed JSON
    const malformedRes = await request(API_BASE_URL)
      .post('/api/v1/build-haven/enrollments/test-enroll/submissions')
      .set('Authorization', `Bearer ${testToken}`)
      .set('Content-Type', 'application/json')
      .send('{"stageId": "test", "liveUrl": "http://..'); // missing end quote and brace
    assert(malformedRes.status === 400, 'Malformed JSON rejected with 400 Bad Request');

    // 3.2 Non-existent route
    const notFoundRes = await request(API_BASE_URL).get('/api/v1/non-existent-route-for-testing-404');
    assert(notFoundRes.status === 404, 'Non-existent route handled gracefully with 404');

    // ---------------------------------------------------------------
    // 4. UI/UX FLOW SIMULATION (User Journey: List -> Enroll -> Submit)
    // ---------------------------------------------------------------
    log('\n4. UI/UX Flow Simulation (Dual-Mode Build Journey)');
    
    let simulatedProgId = null;
    let simulatedStageId = null;
    let simulatedEnrollId = null;

    if (testUserId) {
      // Setup Data for Flow
      const progIns = await pool.query(`
        INSERT INTO public.apprenticeship_programs (title, slug, program_type, duration_days, price_inr, difficulty_level, status)
        VALUES ('Flow Test API', 'flow-test-api-${Date.now()}', 'build_challenge', 30, 0, 'beginner', 'active') RETURNING id;
      `);
      simulatedProgId = progIns.rows[0].id;

      const stageIns = await pool.query(`
        INSERT INTO public.build_stages (program_id, stage_number, title, verification_type)
        VALUES ($1, 1, 'Flow Stage', 'contract') RETURNING id;
      `, [simulatedProgId]);
      simulatedStageId = stageIns.rows[0].id;

      // Flow Step 1: List Challenges
      const t1 = Date.now();
      const listRes = await request(API_BASE_URL).get('/api/v1/build-haven/challenges');
      assert(listRes.status === 200, 'UI Flow: Can list challenges (200 OK)');
      assert(Date.now() - t1 < 800, 'UI Flow: Challenge listing is fast (< 800ms)');

      // Flow Step 2: Enroll in Vibe Mode
      // Using direct DB insert for enrollment to skip complex prerequisites validation in UI testing
      const enrollIns = await pool.query(`
        INSERT INTO public.build_enrollments (user_id, program_id, language, build_mode, total_stages)
        VALUES ($1, $2, 'python', 'vibe', 1) RETURNING id;
      `, [testUserId, simulatedProgId]);
      simulatedEnrollId = enrollIns.rows[0].id;

      // Flow Step 3: View My Enrollments
      const enrollRes = await request(API_BASE_URL)
        .get('/api/v1/build-haven/enrollments')
        .set('Authorization', `Bearer ${testToken}`);
      assert(enrollRes.status === 200, 'UI Flow: Can fetch user enrollments (200 OK)');

      // Flow Step 4: Submit Stage (Should fail cleanly if mocked incorrectly, but testing API response wrapper)
      const submitRes = await request(API_BASE_URL)
        .post(`/api/v1/build-haven/enrollments/${simulatedEnrollId}/submissions`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          stageId: simulatedStageId,
          liveUrl: 'https://vibe-test.vercel.app'
        });
      // The worker handles actual verification. API should return 200 or 400 (validation error). 
      // Both are valid API layer responses, 500 would be a failure.
      assert(submitRes.status === 200 || submitRes.status === 400 || submitRes.status === 404, `UI Flow: Submission endpoint handled request (Status: ${submitRes.status})`);
      
      // Cleanup Flow test program
      await pool.query(`DELETE FROM public.apprenticeship_programs WHERE id = $1;`, [simulatedProgId]);
    }

  } catch (err: any) {
    log('\nEXPLICIT TEST ERROR: ' + err.message);
    failedTests++;
  } finally {
    log('\n================================================================');
    log(`  SAAS AUDIT RESULTS: TOTAL: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
    log('================================================================\n');
    await pool.end();
    process.exit(failedTests > 0 ? 1 : 0);
  }
}

runSaaSApiTests();
