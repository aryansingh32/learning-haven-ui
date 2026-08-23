import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { fail, ok } from '../apprenticeship/http';
import { BuildHavenService } from './service';
import logger from '../../config/logger';

const p = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value || '');

export class BuildHavenController {
  static async listChallenges(req: Request, res: Response) {
    try {
      const challenges = await BuildHavenService.listChallenges({
        difficulty: req.query.difficulty as string | undefined,
        status: (req.query.status as string | undefined) || 'active',
        language: req.query.language as string | undefined,
      });
      res.json(ok({ challenges, total: challenges.length }));
    } catch {
      res.status(500).json(fail('Failed to fetch challenges', 'E_BUILD_500'));
    }
  }

  static async getChallengeBySlug(req: Request, res: Response) {
    try {
      const challenge = await BuildHavenService.getChallengeBySlug(p(req.params.slug));
      if (!challenge) {
        return res.status(404).json(fail('Challenge not found', 'E_BUILD_404'));
      }
      res.json(ok({ challenge }));
    } catch {
      res.status(500).json(fail('Failed to fetch challenge', 'E_BUILD_501'));
    }
  }

  static async getWorkspace(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user?.id;
      if (!userId) return res.status(401).json(fail('Unauthorized', 'E_AUTH_401'));
      const language = typeof req.query.language === 'string' ? req.query.language : undefined;
      const workspace = await BuildHavenService.getWorkspace(userId, p(req.params.slug), language);
      if (!workspace) return res.status(404).json(fail('Challenge not found', 'E_BUILD_404'));
      res.json(ok({ workspace }));
    } catch {
      res.status(500).json(fail('Failed to fetch workspace', 'E_BUILD_502'));
    }
  }

  static async getLeaderboard(req: Request, res: Response) {
    try {
      const challenge = await BuildHavenService.getChallengeBySlug(p(req.params.slug));
      if (!challenge) return res.status(404).json(fail('Challenge not found', 'E_BUILD_404'));
      const language = typeof req.query.language === 'string' ? req.query.language : undefined;
      const leaderboard = await BuildHavenService.getLeaderboard(challenge.id, language);
      res.json(ok({ leaderboard }));
    } catch {
      res.status(500).json(fail('Failed to fetch leaderboard', 'E_BUILD_504'));
    }
  }

  static async startChallenge(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user?.id;
      if (!userId) return res.status(401).json(fail('Unauthorized', 'E_AUTH_401'));
      const language = String(req.body.language || '');
      if (!language) return res.status(400).json(fail('language is required', 'E_BUILD_400'));
      const buildMode = (req.body.build_mode === 'vibe' ? 'vibe' : 'traditional') as 'traditional' | 'vibe';

      const data = await BuildHavenService.startChallenge(userId, p(req.params.slug), language, buildMode);
      res.json(ok(data));
    } catch (error: any) {
      logger.error('Error:', error);
      res.status(400).json(fail(error.message || 'Failed to start challenge', 'E_BUILD_503'));
    }
  }

  static async getMyEnrollments(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user?.id;
      if (!userId) return res.status(401).json(fail('Unauthorized', 'E_AUTH_401'));
      
      const enrollments = await BuildHavenService.getMyEnrollments(userId);
      res.json(ok({ enrollments }));
    } catch (error: any) {
      logger.error('Error fetching build enrollments:', error);
      res.status(500).json(fail('Failed to fetch enrollments', 'E_BUILD_505'));
    }
  }

  static async adminListChallenges(req: Request, res: Response) {
    try {
      const challenges = await BuildHavenService.listChallenges({
        difficulty: req.query.difficulty as string | undefined,
        status: req.query.status as string | undefined,
        language: req.query.language as string | undefined,
      });
      res.json(ok({ challenges, total: challenges.length }));
    } catch {
      res.status(500).json(fail('Failed to fetch challenges', 'E_ADMIN_BUILD_500'));
    }
  }

  static async adminGetChallenge(req: Request, res: Response) {
    try {
      const challenge = await BuildHavenService.getChallengeById(p(req.params.id));
      if (!challenge) return res.status(404).json(fail('Challenge not found', 'E_ADMIN_BUILD_404'));
      const [stages, languages] = await Promise.all([
        BuildHavenService.listStages(p(req.params.id)),
        BuildHavenService.listLanguages(p(req.params.id)),
      ]);
      res.json(ok({ challenge, stages, languages }));
    } catch {
      res.status(500).json(fail('Failed to fetch challenge', 'E_ADMIN_BUILD_501'));
    }
  }

  static async adminCreateChallenge(req: Request, res: Response) {
    try {
      const challenge = await BuildHavenService.createChallenge(req.body);
      res.status(201).json(ok({ challenge }));
    } catch (error: any) {
      logger.error('adminCreateChallenge error:', error);
      res.status(400).json(fail(error.message || 'Failed to create challenge', 'E_ADMIN_BUILD_502'));
    }
  }

  static async adminUpdateChallenge(req: Request, res: Response) {
    try {
      const challenge = await BuildHavenService.updateChallenge(p(req.params.id), req.body);
      res.json(ok({ challenge }));
    } catch (error: any) {
      logger.error('Error:', error);
      res.status(400).json(fail(error.message || 'Failed to update challenge', 'E_ADMIN_BUILD_503'));
    }
  }

  static async adminListStages(req: Request, res: Response) {
    try {
      const stages = await BuildHavenService.listStages(p(req.params.programId));
      res.json(ok({ stages }));
    } catch {
      res.status(500).json(fail('Failed to fetch stages', 'E_ADMIN_BUILD_510'));
    }
  }

  static async adminCreateStage(req: Request, res: Response) {
    try {
      const stage = await BuildHavenService.createStage(p(req.params.programId), req.body);
      res.status(201).json(ok({ stage }));
    } catch (error: any) {
      logger.error('Error:', error);
      res.status(400).json(fail(error.message || 'Failed to create stage', 'E_ADMIN_BUILD_511'));
    }
  }

  static async adminUpdateStage(req: Request, res: Response) {
    try {
      const stage = await BuildHavenService.updateStage(p(req.params.stageId), req.body);
      res.json(ok({ stage }));
    } catch (error: any) {
      logger.error('Error:', error);
      res.status(400).json(fail(error.message || 'Failed to update stage', 'E_ADMIN_BUILD_512'));
    }
  }

  static async adminDeleteStage(req: Request, res: Response) {
    try {
      await BuildHavenService.deleteStage(p(req.params.stageId));
      res.json(ok({ message: 'Stage deleted' }));
    } catch {
      res.status(500).json(fail('Failed to delete stage', 'E_ADMIN_BUILD_513'));
    }
  }

  static async adminReorderStages(req: Request, res: Response) {
    try {
      await BuildHavenService.reorderStages(p(req.params.programId), req.body.order || []);
      res.json(ok({ message: 'Stages reordered' }));
    } catch {
      res.status(500).json(fail('Failed to reorder stages', 'E_ADMIN_BUILD_514'));
    }
  }

  static async adminListLanguages(req: Request, res: Response) {
    try {
      const languages = await BuildHavenService.listLanguages(p(req.params.programId));
      res.json(ok({ languages }));
    } catch {
      res.status(500).json(fail('Failed to fetch languages', 'E_ADMIN_BUILD_520'));
    }
  }

  static async adminUpsertLanguage(req: Request, res: Response) {
    try {
      const language = await BuildHavenService.upsertLanguage(p(req.params.programId), req.body);
      res.json(ok({ language }));
    } catch (error: any) {
      logger.error('Error:', error);
      res.status(400).json(fail(error.message || 'Failed to save language', 'E_ADMIN_BUILD_521'));
    }
  }

  static async adminUpdateLanguage(req: Request, res: Response) {
    try {
      const language = await BuildHavenService.updateLanguage(p(req.params.langId), req.body);
      res.json(ok({ language }));
    } catch (error: any) {
      logger.error('Error:', error);
      res.status(400).json(fail(error.message || 'Failed to update language', 'E_ADMIN_BUILD_523'));
    }
  }

  static async adminDeleteLanguage(req: Request, res: Response) {
    try {
      await BuildHavenService.removeLanguage(p(req.params.programId), p(req.params.language));
      res.json(ok({ message: 'Language removed' }));
    } catch {
      res.status(500).json(fail('Failed to remove language', 'E_ADMIN_BUILD_522'));
    }
  }

  static async adminDeleteLanguageById(req: Request, res: Response) {
    try {
      await BuildHavenService.removeLanguageById(p(req.params.langId));
      res.json(ok({ message: 'Language removed' }));
    } catch (error) {
      logger.error('Failed to remove language by id', error);
      res.status(500).json(fail('Failed to remove language', 'E_ADMIN_BUILD_524'));
    }
  }

  static async adminArchiveChallenge(req: Request, res: Response) {
    try {
      const challenge = await BuildHavenService.archiveChallenge(p(req.params.id));
      res.json(ok({ challenge }));
    } catch (error: any) {
      logger.error('Error:', error);
      res.status(400).json(fail(error.message || 'Failed to archive challenge', 'E_ADMIN_BUILD_530'));
    }
  }

  static async adminHardDeleteChallenge(req: Request, res: Response) {
    try {
      const result = await BuildHavenService.hardDeleteChallenge(p(req.params.id));
      res.json(ok(result));
    } catch (error: any) {
      logger.error('Error:', error);
      res.status(400).json(fail(error.message || 'Failed to permanently delete challenge', 'E_ADMIN_BUILD_531'));
    }
  }

  static async adminBulkDeleteChallenges(req: Request, res: Response) {
    try {
      const { ids, permanent } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json(fail('ids array is required', 'E_ADMIN_BUILD_400'));
      }
      const result = await BuildHavenService.bulkDeleteChallenges(ids, Boolean(permanent));
      res.json(ok(result));
    } catch (error: any) {
      logger.error('Error:', error);
      res.status(400).json(fail(error.message || 'Failed to bulk delete challenges', 'E_ADMIN_BUILD_532'));
    }
  }

  static async adminGetAnalytics(req: Request, res: Response) {
    try {
      const analytics = await BuildHavenService.getAnalytics(p(req.params.id));
      res.json(ok({ analytics }));
    } catch {
      res.status(500).json(fail('Failed to fetch analytics', 'E_ADMIN_BUILD_540'));
    }
  }

  static async celebrateStage(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user?.id;
      if (!userId) return res.status(401).json(fail('Unauthorized', 'E_AUTH_401'));
      const slug = p(req.params.slug);
      const stageNumber = parseInt(p(req.params.stageNumber), 10);
      if (isNaN(stageNumber)) return res.status(400).json(fail('Invalid stage number', 'E_BUILD_400'));

      const enrollment = await BuildHavenService.celebrateStage(userId, slug, stageNumber);
      res.json(ok({ enrollment }));
    } catch (error: any) {
      logger.error('celebrateStage error:', error);
      res.status(400).json(fail(error.message || 'Failed to celebrate stage', 'E_BUILD_505'));
    }
  }

  static async adminListEnrollments(req: Request, res: Response) {
    try {
      const programId = p(req.params.programId);
      const filters = {
        language: req.query.language as string | undefined,
        status: req.query.status as string | undefined,
        search: req.query.search as string | undefined,
      };
      const result = await BuildHavenService.adminListEnrollments(programId, filters);
      res.json(ok({ enrollments: result.enrollments, total: result.total }));
    } catch (error: any) {
      logger.error('adminListEnrollments error:', error);
      res.status(500).json(fail('Failed to fetch enrollments', 'E_ADMIN_BUILD_550'));
    }
  }

  static async vibeSubmitStage(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user?.id;
      if (!userId) return res.status(401).json(fail('Unauthorized', 'E_AUTH_401'));

      const enrollmentId = p(req.params.enrollmentId);
      const stageId = p(req.params.stageId);
      const { submission_source, submission_ref } = req.body;

      if (!submission_ref) return res.status(400).json(fail('submission_ref is required', 'E_BUILD_400'));

      const source: 'github_push' | 'live_url' =
        submission_source === 'live_url' ? 'live_url' : 'github_push';

      const result = await BuildHavenService.submitVibeStage({
        enrollmentId,
        stageId,
        userId,
        submissionSource: source,
        submissionRef: submission_ref,
      });

      res.json(ok({ result }));
    } catch (error: any) {
      logger.error('vibeSubmitStage error:', error);
      res.status(400).json(fail(error.message || 'Failed to submit vibe stage', 'E_BUILD_560'));
    }
  }

  static async adminManualPassStage(req: Request, res: Response) {
    try {
      const enrollmentId = p(req.params.enrollmentId);
      const stageId = p(req.params.stageId);
      const adminUserId = (req as AuthRequest).user?.id;
      if (!adminUserId) return res.status(401).json(fail('Unauthorized', 'E_AUTH_401'));

      await BuildHavenService.adminManualPassStage(enrollmentId, stageId, adminUserId);
      res.json(ok({ message: 'Stage passed manually' }));
    } catch (error: any) {
      logger.error('adminManualPassStage error:', error);
      res.status(400).json(fail(error.message || 'Failed to manually pass stage', 'E_ADMIN_BUILD_551'));
    }
  }

  static async getProgressBadge(req: Request, res: Response) {
    try {
      const username = p(req.params.username);
      const slug = p(req.params.slug);
      
      const svg = await BuildHavenService.generateProgressBadgeSvg(username, slug);
      if (!svg) {
        return res.status(404).send('Not found');
      }

      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(svg);
    } catch (error: any) {
      logger.error('getProgressBadge error:', error);
      res.status(500).send('Internal Server Error');
    }
  }
}
