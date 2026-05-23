import { Request, Response } from 'express';
import { SubmissionsService } from './submissions.service';
import logger from '../../config/logger';
import { AuthRequest } from '../../middleware/auth';
import { fail, ok } from './http';

const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value || '');

export class SubmissionsController {
  static async getSubmissionStatus(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user?.id;
      if (!userId) {
        return res.status(401).json(fail('Unauthorized', 'E_AUTH_401'));
      }

      const submission = await SubmissionsService.getSubmissionStatus(param(req.params.id), userId);
      res.json(ok({ submission }));
    } catch (error) {
      logger.error('Error in getSubmissionStatus:', error);
      res.status(500).json(fail('Failed to fetch submission', 'E_SUB_500'));
    }
  }

  static async getTestStages(req: Request, res: Response) {
    try {
      const stages = await SubmissionsService.getTestStages(param(req.params.id));
      res.json(ok({ stages }));
    } catch (error) {
      logger.error('Error in getTestStages:', error);
      res.status(500).json(fail('Failed to fetch test stages', 'E_SUB_501'));
    }
  }

  static async getMySubmissions(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user?.id;
      if (!userId) {
        return res.status(401).json(fail('Unauthorized', 'E_AUTH_401'));
      }

      const submissions = await SubmissionsService.getMySubmissions(
        userId,
        req.query.enrollmentId as string | undefined,
        req.query.projectId as string | undefined
      );

      res.json(ok({ submissions }));
    } catch (error) {
      logger.error('Error in getMySubmissions:', error);
      res.status(500).json(fail('Failed to fetch submissions', 'E_SUB_502'));
    }
  }
}
