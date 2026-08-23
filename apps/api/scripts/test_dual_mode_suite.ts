import dotenv from 'dotenv';
dotenv.config();

import { supabase, pool } from '../src/config/database';
import { BuildHavenService } from '../src/modules/build-haven/service';
import logger from '../src/config/logger';

// Colors for terminal output
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';

let passedCount = 0;
let failedCount = 0;
let totalCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`  ${GREEN}✓ PASS:${RESET} ${testName}`);
  } else {
    failedCount++;
    console.log(`  ${RED}✗ FAIL:${RESET} ${testName}`);
    if (detail) console.log(`     ${RED}Reason: ${detail}${RESET}`);
  }
}

async function runTests() {
  console.log(`\n${BOLD}${CYAN}=== DUAL-MODE VIBE CODING & SYSTEM COMPREHENSIVE TEST SUITE ===${RESET}\n`);

  let testProgramId: string | null = null;
  let testStageId: string | null = null;
  let testContractStageId: string | null = null;
  let testUserId: string | null = null;
  let vibeEnrollmentId: string | null = null;
  let traditionalEnrollmentId: string | null = null;

  try {
    // -------------------------------------------------------------------------
    // 1. DATABASE SCHEMA & CONSTRAINTS VERIFICATION
    // -------------------------------------------------------------------------
    console.log(`${BOLD}1. Database Schema & Dual-Mode Column Verification${RESET}`);
    
    const dbColCheck = await pool.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'apprenticeship_programs' 
        AND column_name IN ('available_modes', 'default_mode', 'reference_demo_url', 'product_contract');
    `);
    
    assert(
      dbColCheck.rows.length === 4,
      'DB Schema: All 4 dual-mode columns exist in apprenticeship_programs',
      `Found ${dbColCheck.rows.length}/4 columns`
    );

    const stageColCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'build_stages' 
        AND column_name IN ('verification_type', 'acceptance_contract');
    `);

    assert(
      stageColCheck.rows.length === 2,
      'DB Schema: build_stages has verification_type and acceptance_contract columns',
      `Found ${stageColCheck.rows.length}/2 columns`
    );

    // -------------------------------------------------------------------------
    // 2. CHALLENGE CRUD - DUAL MODE CONFIGURATION
    // -------------------------------------------------------------------------
    console.log(`\n${BOLD}2. Challenge CRUD with Dual-Mode Configuration${RESET}`);

    const testSlug = `test-dual-mode-challenge-${Date.now()}`;
    const newChallenge = await BuildHavenService.createChallenge({
      title: 'Test Dual-Mode Challenge',
      slug: testSlug,
      description: 'Comprehensive test challenge for traditional vs vibe modes',
      short_tagline: 'Test Tagline',
      difficulty_level: 'beginner',
      status: 'active',
      is_free: true,
      supported_languages: ['python', 'nodejs'],
      available_modes: ['traditional', 'vibe'],
      default_mode: 'vibe',
      reference_demo_url: 'https://demo.example.com/vibe-app',
      product_contract: '## Requirements\n- Must create tasks\n- Must persist tasks',
    });

    testProgramId = newChallenge.id;

    assert(Boolean(testProgramId), 'Create Challenge: Successfully returned challenge ID');
    assert(
      Array.isArray(newChallenge.available_modes) &&
        newChallenge.available_modes.includes('traditional') &&
        newChallenge.available_modes.includes('vibe'),
      'Create Challenge: available_modes saved correctly as ["traditional", "vibe"]'
    );
    assert(
      newChallenge.default_mode === 'vibe',
      'Create Challenge: default_mode saved correctly as "vibe"'
    );
    assert(
      newChallenge.reference_demo_url === 'https://demo.example.com/vibe-app',
      'Create Challenge: reference_demo_url saved correctly'
    );

    // -------------------------------------------------------------------------
    // 3. HUMAN ERROR & EDGE CASES - INVALID MODES & CONSTRAINTS
    // -------------------------------------------------------------------------
    console.log(`\n${BOLD}3. Human Error & Edge Case: Invalid Default Mode Constraint${RESET}`);

    let caughtError = false;
    try {
      await pool.query(`
        INSERT INTO public.apprenticeship_programs (title, slug, program_type, default_mode, duration_days, price_inr, difficulty_level, status)
        VALUES ('Invalid Mode Test', 'invalid-mode-test-${Date.now()}', 'build_challenge', 'super_vibe', 30, 0, 'beginner', 'draft');
      `);
    } catch (err: any) {
      caughtError = true;
      const msg = err.message || String(err);
      const isConstraintError = msg.includes('check constraint') || msg.includes('default_mode') || msg.includes('violates check constraint');
      assert(
        isConstraintError,
        'Edge Case: DB check constraint blocks invalid default_mode ("super_vibe")',
        `Actual Error: ${msg}`
      );
    }
    if (!caughtError) {
      assert(false, 'Edge Case: DB check constraint blocks invalid default_mode ("super_vibe")', 'Allowed invalid mode without error');
    }

    // Configure language for test challenge (required for startChallenge)
    await BuildHavenService.upsertLanguage(testProgramId, {
      language: 'python',
      starter_repo_url: 'https://github.com/learning-haven/python-starter',
    });

    // -------------------------------------------------------------------------
    // 4. STAGE CRUD - TRADITIONAL (DOCKER_TEST) & VIBE (CONTRACT) STAGES
    // -------------------------------------------------------------------------
    console.log(`\n${BOLD}4. Stage CRUD - Traditional vs Vibe Verification Types${RESET}`);

    // Stage 1: Docker Test (Traditional)
    const stage1 = await BuildHavenService.createStage(testProgramId, {
      stage_number: 1,
      title: 'Stage 1: Traditional Test',
      difficulty: 'easy',
      description: 'First stage with traditional docker test',
      test_command: 'pytest',
      docker_test_image: 'python:3.11-slim',
      verification_type: 'docker_test',
    });
    testStageId = stage1.id;
    assert(stage1.verification_type === 'docker_test', 'Stage 1: Created with verification_type = "docker_test"');

    // Stage 2: Acceptance Contract (Vibe)
    const contractObj = {
      journeys: [
        {
          id: 'user_registration',
          label: 'User can register and see dashboard',
          public: true,
          steps: [
            { action: 'goto', target: '/' },
            { action: 'click', target: 'Sign Up' },
            { action: 'fill', target: '#email', value: 'test@example.com' },
            { action: 'expect_visible', target: '.dashboard' },
          ],
        },
      ],
    };

    const stage2 = await BuildHavenService.createStage(testProgramId, {
      stage_number: 2,
      title: 'Stage 2: Vibe Acceptance Contract',
      difficulty: 'medium',
      description: 'Second stage with Playwright acceptance contract',
      verification_type: 'contract',
      acceptance_contract: contractObj,
    });
    testContractStageId = stage2.id;
    assert(stage2.verification_type === 'contract', 'Stage 2: Created with verification_type = "contract"');
    assert(
      stage2.acceptance_contract?.journeys?.[0]?.id === 'user_registration',
      'Stage 2: acceptance_contract JSON parsed and stored correctly'
    );

    // -------------------------------------------------------------------------
    // 5. ENROLLMENT & MODE SWITCHING
    // -------------------------------------------------------------------------
    console.log(`\n${BOLD}5. Challenge Enrollment & Mode Selection${RESET}`);

    // Fetch a test user ID from DB
    const userRes = await pool.query(`SELECT id FROM public.users LIMIT 1;`);
    if (userRes.rows.length === 0) {
      console.log(`  ${YELLOW}! Skipping user enrollment test (no users in DB)${RESET}`);
    } else {
      testUserId = userRes.rows[0].id;

      // Start Challenge in VIBE Mode
      const vibeStartResult = await BuildHavenService.startChallenge(
        testUserId,
        testSlug,
        'python',
        'vibe'
      );

      vibeEnrollmentId = vibeStartResult.enrollment.id;
      assert(
        vibeStartResult.enrollment.build_mode === 'vibe',
        'Start Challenge (Vibe): enrollment.build_mode saved as "vibe"'
      );
      assert(
        vibeStartResult.repository === null,
        'Start Challenge (Vibe): GitHub repo creation bypassed (repository = null)'
      );
      assert(
        vibeStartResult.clone_command === null,
        'Start Challenge (Vibe): clone_command is null for vibe mode'
      );

      // Fetch enrollment from DB to double check
      const { data: dbEnrollment } = await supabase
        .from('build_enrollments')
        .select('*')
        .eq('id', vibeEnrollmentId)
        .single();

      assert(
        dbEnrollment.build_mode === 'vibe',
        'DB Check: build_enrollments row has build_mode = "vibe"'
      );
    }

    // -------------------------------------------------------------------------
    // 6. VIBE STAGE SUBMISSIONS & HUMAN ERROR HANDLING
    // -------------------------------------------------------------------------
    console.log(`\n${BOLD}6. Vibe Stage Submissions & Error Handling${RESET}`);

    if (vibeEnrollmentId && testContractStageId && testUserId) {
      // Test Valid Vibe Submission (Live URL)
      const validSubResult = await BuildHavenService.submitVibeStage({
        enrollmentId: vibeEnrollmentId,
        stageId: testContractStageId,
        userId: testUserId,
        submissionSource: 'live_url',
        submissionRef: 'https://my-vibe-build.vercel.app',
      });

      assert(
        validSubResult.enrollment_id === vibeEnrollmentId,
        'Submit Vibe Stage: Successfully created gate verification result'
      );
      assert(
        validSubResult.submission_source === 'live_url',
        'Submit Vibe Stage: Recorded submission_source = "live_url"'
      );
      assert(
        validSubResult.submission_ref === 'https://my-vibe-build.vercel.app',
        'Submit Vibe Stage: Recorded submission_ref correctly'
      );

      // Edge Case: Human submits missing submission_ref
      let missingRefError = false;
      try {
        await BuildHavenService.submitVibeStage({
          enrollmentId: vibeEnrollmentId,
          stageId: testContractStageId,
          userId: testUserId,
          submissionSource: 'live_url',
          submissionRef: '', // Invalid empty ref
        });
      } catch (err: any) {
        missingRefError = true;
        assert(
          err.message.includes('submission_ref is required'),
          'Edge Case: Empty submission_ref correctly rejected with descriptive error'
        );
      }
      if (!missingRefError) {
        assert(false, 'Edge Case: Empty submission_ref correctly rejected');
      }

      // Edge Case: Unauthorized user submitting someone else's enrollment
      let unauthError = false;
      try {
        await BuildHavenService.submitVibeStage({
          enrollmentId: vibeEnrollmentId,
          stageId: testContractStageId,
          userId: '00000000-0000-0000-0000-000000000000', // Fake user
          submissionSource: 'live_url',
          submissionRef: 'https://unauth.app',
        });
      } catch (err: any) {
        unauthError = true;
        assert(
          err.message.includes('Enrollment not found'),
          'Edge Case: Submitting for unauthorized/mismatched user correctly rejected'
        );
      }
      if (!unauthError) {
        assert(false, 'Edge Case: Submitting for unauthorized user rejected');
      }
    }

    // -------------------------------------------------------------------------
    // 7. ADMIN MANUAL PASS OVERRIDE
    // -------------------------------------------------------------------------
    console.log(`\n${BOLD}7. Admin Manual Pass Stage Override${RESET}`);

    if (vibeEnrollmentId && testStageId && testUserId) {
      const passResult = await BuildHavenService.adminManualPassStage(
        vibeEnrollmentId,
        testStageId,
        testUserId // admin user
      );

      assert(
        passResult.success === true,
        'Admin Manual Pass: Execution succeeded'
      );

      // Verify stage result record created with manual override flags
      const { data: stageResult } = await supabase
        .from('build_stage_results')
        .select('*')
        .eq('enrollment_id', vibeEnrollmentId)
        .eq('stage_id', testStageId)
        .single();

      assert(
        stageResult?.passed === true,
        'Admin Manual Pass: Stage result set to passed = true'
      );
      assert(
        stageResult?.is_manual_override === true,
        'Admin Manual Pass: Flagged as is_manual_override = true'
      );
    }

    // -------------------------------------------------------------------------
    // 8. TEARDOWN & CLEANUP
    // -------------------------------------------------------------------------
    console.log(`\n${BOLD}8. Teardown & Cleanup${RESET}`);

    if (testProgramId) {
      // Delete test challenge (cascades to stages, enrollments, stage results)
      await pool.query(`DELETE FROM public.apprenticeship_programs WHERE id = $1;`, [testProgramId]);
      assert(true, 'Teardown: Successfully cleaned up test challenge data from database');
    }

  } catch (error: any) {
    console.error(`\n${RED}${BOLD}UNHANDLED EXCEPTION IN TEST SUITE:${RESET}`, error);
    failedCount++;
  } finally {
    console.log(`\n${BOLD}${CYAN}=====================================================${RESET}`);
    console.log(`${BOLD}TEST RESULTS:${RESET}`);
    console.log(`  Total Tests : ${totalCount}`);
    console.log(`  Passed      : ${GREEN}${passedCount}${RESET}`);
    console.log(`  Failed      : ${failedCount > 0 ? RED : GREEN}${failedCount}${RESET}`);
    console.log(`${BOLD}${CYAN}=====================================================${RESET}\n`);

    try {
      await pool.end();
    } catch {}
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runTests();
