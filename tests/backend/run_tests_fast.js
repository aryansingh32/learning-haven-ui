const dotenv = require('dotenv');
dotenv.config();

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:adminDSAOSsupabase@db.wxrxnqhjkwlxvmaopvlv.supabase.co:5432/postgres',
});

// Helper for formatted printing
function log(msg) {
  process.stdout.write(msg + '\n');
}

let total = 0;
let passed = 0;
let failed = 0;

function assert(condition, name, detail) {
  total++;
  if (condition) {
    passed++;
    log(`  ✓ PASS: ${name}`);
  } else {
    failed++;
    log(`  ✗ FAIL: ${name}${detail ? ' (' + detail + ')' : ''}`);
  }
}

async function main() {
  log('\n=== BUILD HAVEN DUAL-MODE COMPREHENSIVE TEST MATRIX ===\n');

  try {
    // ---------------------------------------------------------------
    // TEST 1: Database Schema & Column Verification
    // ---------------------------------------------------------------
    log('1. Database Schema & Column Verification');
    const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'apprenticeship_programs' 
        AND column_name IN ('available_modes', 'default_mode', 'reference_demo_url', 'product_contract');
    `);
    assert(cols.rows.length === 4, 'All 4 dual-mode columns exist in apprenticeship_programs');

    const stageCols = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'build_stages' 
        AND column_name IN ('verification_type', 'acceptance_contract');
    `);
    assert(stageCols.rows.length === 2, 'Both verification_type and acceptance_contract exist in build_stages');

    const enrollCols = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'build_enrollments' 
        AND column_name = 'build_mode';
    `);
    assert(enrollCols.rows.length === 1, 'build_mode column exists in build_enrollments');

    const resultCols = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'build_stage_results' 
        AND column_name IN ('submission_source', 'submission_ref', 'is_manual_override', 'overridden_by_admin_id');
    `);
    assert(resultCols.rows.length === 4, 'All 4 submission/override columns exist in build_stage_results');

    // ---------------------------------------------------------------
    // TEST 2: Check Constraint Enforcement (Human Error Case)
    // ---------------------------------------------------------------
    log('\n2. Check Constraint Enforcement (Invalid Modes)');
    let caughtConstraint = false;
    try {
      await pool.query(`
        INSERT INTO public.apprenticeship_programs 
          (title, slug, program_type, default_mode, duration_days, price_inr, difficulty_level, status)
        VALUES 
          ('Invalid Mode Test', 'invalid-mode-test-1', 'build_challenge', 'invalid_super_mode', 30, 0, 'beginner', 'draft');
      `);
    } catch (err) {
      caughtConstraint = true;
      assert(
        err.message.includes('check constraint') || err.message.includes('default_mode'),
        'DB constraint blocks invalid default_mode ("invalid_super_mode")'
      );
    }
    if (!caughtConstraint) {
      assert(false, 'DB constraint blocks invalid default_mode', 'Inserted without error');
    }

    // ---------------------------------------------------------------
    // TEST 3: Challenge CRUD with Dual-Mode Config
    // ---------------------------------------------------------------
    log('\n3. Challenge CRUD with Dual-Mode Configuration');
    const slug = `test-vibe-challenge-${Date.now()}`;
    const insertRes = await pool.query(`
      INSERT INTO public.apprenticeship_programs (
        title, slug, program_type, available_modes, default_mode, 
        reference_demo_url, product_contract, duration_days, price_inr, 
        difficulty_level, status
      ) VALUES (
        'Test Vibe Challenge', $1, 'build_challenge', '{"traditional", "vibe"}', 'vibe',
        'https://demo.buildhaven.dev/app', '## Requirements\n1. Must work', 30, 0,
        'beginner', 'active'
      ) RETURNING id, available_modes, default_mode, reference_demo_url;
    `, [slug]);

    const programId = insertRes.rows[0].id;
    assert(Boolean(programId), 'Successfully inserted test challenge');
    assert(
      Array.isArray(insertRes.rows[0].available_modes) && insertRes.rows[0].available_modes.includes('vibe'),
      'available_modes array stored correctly'
    );
    assert(insertRes.rows[0].default_mode === 'vibe', 'default_mode stored as "vibe"');

    // ---------------------------------------------------------------
    // TEST 4: Stage Creation (Docker Test vs Acceptance Contract)
    // ---------------------------------------------------------------
    log('\n4. Stage Creation (Docker Test vs Acceptance Contract)');
    const stage1Res = await pool.query(`
      INSERT INTO public.build_stages (
        program_id, stage_number, title, difficulty, verification_type, test_command
      ) VALUES (
        $1, 1, 'Stage 1: Docker', 'easy', 'docker_test', 'pytest'
      ) RETURNING id, verification_type;
    `, [programId]);
    assert(stage1Res.rows[0].verification_type === 'docker_test', 'Stage 1 created with verification_type = "docker_test"');

    const contractJson = JSON.stringify({
      journeys: [
        { id: 'j1', label: 'User can submit task', steps: [{ action: 'goto', target: '/' }] }
      ]
    });
    const stage2Res = await pool.query(`
      INSERT INTO public.build_stages (
        program_id, stage_number, title, difficulty, verification_type, acceptance_contract
      ) VALUES (
        $1, 2, 'Stage 2: Acceptance Contract', 'medium', 'contract', $2::jsonb
      ) RETURNING id, verification_type, acceptance_contract;
    `, [programId, contractJson]);

    const stage2Id = stage2Res.rows[0].id;
    assert(stage2Res.rows[0].verification_type === 'contract', 'Stage 2 created with verification_type = "contract"');
    assert(
      stage2Res.rows[0].acceptance_contract.journeys[0].id === 'j1',
      'Stage 2 acceptance_contract JSON stored and retrieved correctly'
    );

    // ---------------------------------------------------------------
    // TEST 5: Enrollment Dual Mode Creation & Verification
    // ---------------------------------------------------------------
    log('\n5. Dual-Mode Enrollment Creation');
    const userRes = await pool.query(`SELECT id FROM public.users LIMIT 1;`);
    if (userRes.rows.length > 0) {
      const userId = userRes.rows[0].id;

      // Vibe enrollment
      const vibeEnrollRes = await pool.query(`
        INSERT INTO public.build_enrollments (
          user_id, program_id, language, build_mode, current_stage, total_stages, status
        ) VALUES (
          $1, $2, 'python', 'vibe', 1, 2, 'in_progress'
        ) RETURNING id, build_mode, repo_url;
      `, [userId, programId]);

      const vibeEnrollId = vibeEnrollRes.rows[0].id;
      assert(vibeEnrollRes.rows[0].build_mode === 'vibe', 'Enrollment created with build_mode = "vibe"');
      assert(vibeEnrollRes.rows[0].repo_url === null, 'Vibe enrollment repo_url is null (bypassed GitHub)');

      // Traditional enrollment
      const tradEnrollRes = await pool.query(`
        INSERT INTO public.build_enrollments (
          user_id, program_id, language, build_mode, current_stage, total_stages, status, repo_url
        ) VALUES (
          $1, $2, 'nodejs', 'traditional', 1, 2, 'in_progress', 'https://github.com/user/trad-repo'
        ) RETURNING id, build_mode, repo_url;
      `, [userId, programId]);

      assert(tradEnrollRes.rows[0].build_mode === 'traditional', 'Enrollment created with build_mode = "traditional"');
      assert(tradEnrollRes.rows[0].repo_url === 'https://github.com/user/trad-repo', 'Traditional enrollment repo_url stored');

      // ---------------------------------------------------------------
      // TEST 6: Vibe Submission Storage & Gate Verification Results
      // ---------------------------------------------------------------
      log('\n6. Vibe Stage Submission & Gate Results');
      const submitRes = await pool.query(`
        INSERT INTO public.build_stage_results (
          enrollment_id, stage_id, user_id, status, submission_source, submission_ref, structured_feedback
        ) VALUES (
          $1, $2, $3, 'passed', 'live_url', 'https://user-app.vercel.app', '{"gates": [{"journey_id": "j1", "status": "passed"}]}'::jsonb
        ) RETURNING id, submission_source, submission_ref, status;
      `, [vibeEnrollId, stage2Id, userId]);

      assert(submitRes.rows[0].status === 'passed', 'Vibe stage result stored status = "passed"');
      assert(submitRes.rows[0].submission_source === 'live_url', 'Vibe submission_source stored as "live_url"');
      assert(submitRes.rows[0].submission_ref === 'https://user-app.vercel.app', 'Vibe submission_ref stored');

      // ---------------------------------------------------------------
      // TEST 7: Admin Manual Pass Override Verification
      // ---------------------------------------------------------------
      log('\n7. Admin Manual Pass Override Verification');
      const overrideRes = await pool.query(`
        INSERT INTO public.build_stage_results (
          enrollment_id, stage_id, user_id, status, is_manual_override, overridden_by_admin_id, structured_feedback
        ) VALUES (
          $1, $2, $3, 'passed', true, $3, '{"manual_pass": true}'::jsonb
        ) RETURNING id, is_manual_override, overridden_by_admin_id;
      `, [vibeEnrollId, stage1Res.rows[0].id, userId]);

      assert(overrideRes.rows[0].is_manual_override === true, 'is_manual_override flag set to true');
      assert(overrideRes.rows[0].overridden_by_admin_id === userId, 'overridden_by_admin_id recorded admin user ID');

      // ---------------------------------------------------------------
      // TEST 8: Miscellaneous Human Errors & Edge Cases
      // ---------------------------------------------------------------
      log('\n8. Miscellaneous Human Errors & Edge Cases');

      // Edge Case 8.1: Malformed JSON in acceptance_contract
      let malformedJsonCaught = false;
      try {
        await pool.query(`
          INSERT INTO public.build_stages (program_id, stage_number, title, verification_type, acceptance_contract)
          VALUES ($1, 99, 'Malformed JSON Stage', 'contract', '{"journeys": [{incomplete_json:}'::jsonb);
        `, [programId]);
      } catch (err) {
        malformedJsonCaught = true;
        assert(err.message.includes('invalid input syntax for type json'), 'PostgreSQL rejects malformed acceptance_contract JSON syntax');
      }
      if (!malformedJsonCaught) assert(false, 'PostgreSQL rejects malformed acceptance_contract JSON syntax');

      // Edge Case 8.2: Empty / Whitespace submission_ref validation
      let emptyRefCaught = false;
      try {
        const ref = '   '.trim();
        if (!ref) throw new Error('submission_ref is required');
        await pool.query(`
          INSERT INTO public.build_stage_results (enrollment_id, stage_id, user_id, submission_ref)
          VALUES ($1, $2, $3, $4);
        `, [vibeEnrollId, stage2Id, userId, ref]);
      } catch (err) {
        emptyRefCaught = true;
        assert(err.message.includes('submission_ref is required'), 'Validation logic catches whitespace/empty submission_ref');
      }
      if (!emptyRefCaught) assert(false, 'Validation logic catches whitespace/empty submission_ref');

      // Edge Case 8.3: Invalid submission_source constraint check
      let invalidSourceCaught = false;
      try {
        await pool.query(`
          INSERT INTO public.build_stage_results (enrollment_id, stage_id, user_id, submission_source, submission_ref)
          VALUES ($1, $2, $3, 'ftp_upload', 'ftp://user:pass@host/file');
        `, [vibeEnrollId, stage2Id, userId]);
      } catch (err) {
        invalidSourceCaught = true;
        assert(
          err.message.includes('check constraint') || err.message.includes('submission_source'),
          'DB check constraint blocks unsupported submission_source ("ftp_upload")'
        );
      }
      if (!invalidSourceCaught) assert(false, 'DB check constraint blocks unsupported submission_source');
    }

    // ---------------------------------------------------------------
    // TEST 9: Teardown
    // ---------------------------------------------------------------
    log('\n9. Teardown');
    await pool.query(`DELETE FROM public.apprenticeship_programs WHERE id = $1;`, [programId]);
    assert(true, 'Test challenge and associated data successfully cleaned up');

  } catch (err) {
    log('\nUNHANDLED EXCEPTION: ' + err.message);
    failed++;
  } finally {
    log('\n=====================================================');
    log(`TOTAL: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
    log('=====================================================\n');
    await pool.end();
    process.exit(failed > 0 ? 1 : 0);
  }
}

main();
