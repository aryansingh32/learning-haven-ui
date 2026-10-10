import { Request, Response } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import { TestSeriesService } from '../services/testseries.service';
import logger from '../../../config/logger';

export class TestSeriesController {
  static async getCatalog(_req: Request, res: Response) {
    try {
      const result = await TestSeriesService.getCatalog();
      return res.json(result);
    } catch (error: unknown) {
      logger.error('Get test-series catalog error:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getTestMeta(req: Request, res: Response) {
    try {
      const result = await TestSeriesService.getTestMeta(req.params.testId as string, (req as any).user?.id);
      return res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch test';
      logger.error('Get test meta error:', error);
      if (message === 'Test not found') return res.status(404).json({ error: message });
      if (message === 'Test not available') return res.status(400).json({ error: message });
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getCollegeCatalog(req: Request, res: Response) {
    try {
      return res.json(await TestSeriesService.getCollegeCatalog((req as AuthRequest).user!.id));
    } catch (error: unknown) {
      logger.error('Get college test series error:', error);
      return res.status(500).json({ error: 'Failed to load your college\'s test series' });
    }
  }

  static async startAttempt(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user!.id;
      const result = await TestSeriesService.startAttempt(userId, req.params.testId as string);
      return res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to start test';
      logger.error('Start test attempt error:', error);
      if (message === 'Test not found') return res.status(404).json({ error: message });
      if (message === 'This test requires purchase, which is not available yet') {
        return res.status(403).json({ error: message });
      }
      if (message === 'Test not available' || message === 'Test has no questions yet') {
        return res.status(400).json({ error: message });
      }
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async autosaveAnswer(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user!.id;
      const { selectedOptions, natValue, markedForReview } = req.body;
      const result = await TestSeriesService.autosaveAnswer(userId, req.params.attemptId as string, req.params.questionId as string, {
        selectedOptions,
        natValue,
        markedForReview,
      });
      return res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save answer';
      logger.error('Autosave answer error:', error);
      if (message === 'Attempt not found') return res.status(404).json({ error: message });
      if (message === 'Attempt already finalized') return res.status(409).json({ error: message });
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async submitAttempt(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user!.id;
      const result = await TestSeriesService.submitAttempt(userId, req.params.attemptId as string);
      return res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to submit test';
      logger.error('Submit test attempt error:', error);
      if (message === 'Attempt not found') return res.status(404).json({ error: message });
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getAttempt(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user!.id;
      const result = await TestSeriesService.getAttempt(userId, req.params.attemptId as string);
      return res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch attempt';
      logger.error('Get test attempt error:', error);
      if (message === 'Attempt not found') return res.status(404).json({ error: message });
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
