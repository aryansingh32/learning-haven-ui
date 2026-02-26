import { Router } from 'express';
import { RoadmapsController } from '../controllers/roadmaps.controller';
import { authenticateUser, AuthRequest } from '../middleware/auth';
import { ChaptersService } from '../services/chapters.service';
import { supabase } from '../config/database';

const router = Router();

/**
 * @route   GET /api/roadmaps
 * @desc    List all published roadmaps
 * @access  Public
 */
router.get('/', RoadmapsController.listRoadmaps);

/**
 * @route   GET /api/roadmaps/:roadmapId/chapters
 * @desc    Get roadmap chapters with user progress status
 * @access  Private
 */
router.get('/:roadmapId/chapters', authenticateUser, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;
        const { roadmapId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // 1. Fetch the roadmap to check if it is premium
        const { data: roadmap, error: roadmapError } = await supabase
            .from('roadmaps')
            .select('is_premium')
            .eq('id', roadmapId)
            .single();

        if (roadmapError || !roadmap) {
            return res.status(404).json({ error: 'Roadmap not found' });
        }

        // 2. Gating: If premium, verify user's active plan
        if (roadmap.is_premium) {
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('current_plan, plan_expires_at')
                .eq('id', userId)
                .single();

            if (userError || !user) {
                return res.status(403).json({ error: 'User profile not found. Cannot access premium content.' });
            }

            const hasActivePlan =
                user.current_plan &&
                user.current_plan !== 'free' &&
                user.plan_expires_at &&
                new Date(user.plan_expires_at) > new Date();

            if (!hasActivePlan) {
                return res.status(403).json({
                    error: 'Premium roadmap. Active subscription required.',
                    isLocked: true
                });
            }
        }

        const chapters = await ChaptersService.getRoadmapChaptersForUser(userId, roadmapId);
        return res.json({ chapters });
    } catch (error: any) {
        return res.status(500).json({ error: error.message || 'Failed to fetch roadmap chapters' });
    }
});

/**
 * @route   GET /api/roadmaps/:idOrSlug
 * @desc    Get roadmap detail with items
 * @access  Public
 */
router.get('/:idOrSlug', RoadmapsController.getRoadmap);

export default router;
