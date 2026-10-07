/**
 * Code Execution Controller
 * Handles code execution requests from the frontend.
 * Currently supports Java (backend execution via JDK).
 */

import { Request, Response } from 'express';
import { executeJava, isJavaAvailable } from '../services/javaExecutor';
import { executeJavaJudge0, isJudge0Configured, isJudge0Healthy } from '../services/judge0.service';
import { env } from '../../../config/env';
import logger from '../../../config/logger';

type Backend = 'judge0' | 'local' | 'none';

/**
 * Judge0 when configured. The local JDK runner has no real isolation, so it
 * is a development convenience only and is never used in production.
 */
function selectBackend(): Backend {
    if (isJudge0Configured()) return 'judge0';
    return env.NODE_ENV === 'production' ? 'none' : 'local';
}

export class ExecuteController {
    /**
     * POST /api/execute/java
     * Execute Java code against test cases.
     */
    static async executeJava(req: Request, res: Response) {
        try {
            const { code, testCases } = req.body;

            if (!code || typeof code !== 'string') {
                return res.status(400).json({
                    error: 'Invalid request: code is required and must be a string'
                });
            }

            if (!Array.isArray(testCases) || testCases.length === 0) {
                return res.status(400).json({
                    error: 'Invalid request: testCases is required and must be a non-empty array'
                });
            }

            // Validate each test case
            for (const tc of testCases) {
                if (typeof tc.input === 'undefined' || typeof tc.output === 'undefined') {
                    return res.status(400).json({
                        error: 'Each test case must have input and output fields'
                    });
                }
            }

            // Size limits for safety
            if (code.length > 50000) {
                return res.status(400).json({ error: 'Code exceeds maximum size (50KB)' });
            }

            if (testCases.length > 20) {
                return res.status(400).json({ error: 'Maximum 20 test cases allowed' });
            }

            logger.info('Java execution request', {
                codeLength: code.length,
                testCaseCount: testCases.length
            });

            const backend = selectBackend();
            if (backend === 'none') {
                logger.error('Java execution requested but JUDGE0_URL is not configured');
                return res.status(503).json({
                    status: 'Runtime Error',
                    output: 'Code execution is not available right now.',
                    executionTime: 0
                });
            }

            const result = backend === 'judge0'
                ? await executeJavaJudge0(code, testCases)
                : await executeJava(code, testCases);

            logger.info('Java execution complete', {
                backend,
                status: result.status,
                executionTime: result.executionTime
            });

            return res.json(result);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Java execution controller error:', { error: message });
            return res.status(500).json({
                status: 'Runtime Error',
                output: 'Internal server error: ' + message,
                executionTime: 0
            });
        }
    }

    /**
     * GET /api/execute/health
     * Check if execution backends are available.
     */
    static async health(req: Request, res: Response) {
        const backend = selectBackend();
        const javaAvailable = backend === 'judge0'
            ? await isJudge0Healthy()
            : backend === 'local' && await isJavaAvailable();
        return res.json({
            status: 'ok',
            backend,
            languages: {
                java: javaAvailable
            }
        });
    }
}
