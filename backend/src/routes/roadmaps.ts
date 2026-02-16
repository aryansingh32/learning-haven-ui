import { Router } from 'express';
import { RoadmapsController } from '../controllers/roadmaps.controller';

const router = Router();

/**
 * @route   GET /api/roadmaps
 * @desc    List all published roadmaps
 * @access  Public
 */
router.get('/', RoadmapsController.listRoadmaps);

/**
 * @route   GET /api/roadmaps/:idOrSlug
 * @desc    Get roadmap detail with items
 * @access  Public
 */
router.get('/:idOrSlug', RoadmapsController.getRoadmap);

export default router;
