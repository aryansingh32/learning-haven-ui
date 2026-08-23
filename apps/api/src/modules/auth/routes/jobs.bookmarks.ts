import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticateUser } from '../../../middleware/auth';
import { pool } from '../../../config/database';
import { ok, serverError } from '../../../utils/api-response';
import logger from '../../../config/logger';

const router = Router();

// GET /api/user-jobs/bookmarks — list saved jobs
router.get('/bookmarks', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const result = await pool.query(
      `SELECT job_id, job_data, created_at FROM public.job_bookmarks WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return ok(res, { bookmarks: result.rows.map(r => ({ ...r.job_data, id: r.job_id, bookmarked_at: r.created_at })) });
  } catch (e) {
    logger.error('Error fetching job bookmarks', e);
    return serverError(res);
  }
});

// POST /api/user-jobs/bookmarks — save a job
router.post('/bookmarks', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { jobId, jobData } = req.body;
    if (!jobId) return res.status(400).json({ success: false, message: 'jobId required' });
    await pool.query(
      `INSERT INTO public.job_bookmarks (user_id, job_id, job_data)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, job_id) DO UPDATE SET job_data = EXCLUDED.job_data`,
      [userId, jobId, JSON.stringify(jobData || {})]
    );
    return ok(res, { saved: true });
  } catch (e) {
    logger.error('Error saving job bookmark', e);
    return serverError(res);
  }
});

// DELETE /api/user-jobs/bookmarks/:jobId — remove a bookmark
router.delete('/bookmarks/:jobId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { jobId } = req.params;
    await pool.query(
      `DELETE FROM public.job_bookmarks WHERE user_id = $1 AND job_id = $2`,
      [userId, jobId]
    );
    return ok(res, { removed: true });
  } catch (e) {
    logger.error('Error removing job bookmark', e);
    return serverError(res);
  }
});

export default router;
