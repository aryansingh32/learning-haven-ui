import { Request, Response } from 'express';
import { ResumeService } from '../services/resume.service';
import { ok, notFound, serverError, badRequest } from '../../../utils/api-response';
import logger from '../../../config/logger';

export class ResumeController {
  static async load(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const resume = await ResumeService.load(userId);
      return ok(res, { resume: resume?.data ?? null, version: resume?.version ?? 0 });
    } catch (error) {
      logger.error('ResumeController.load error', error);
      return serverError(res);
    }
  }

  static async save(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { data } = req.body;
      if (!data || typeof data !== 'object') {
        return badRequest(res, 'Resume data must be an object');
      }
      const result = await ResumeService.save(userId, data);
      return ok(res, { saved: true, version: result.version });
    } catch (error) {
      logger.error('ResumeController.save error', error);
      return serverError(res);
    }
  }
}
