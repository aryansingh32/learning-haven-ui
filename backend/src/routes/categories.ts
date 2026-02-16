import { Router } from 'express';
import { CategoriesService } from '../services/categories.service';
import logger from '../config/logger';

const router = Router();

/**
 * @route   GET /api/categories
 * @desc    List all categories with patterns
 * @access  Public
 */
router.get('/', async (req, res) => {
    try {
        const categories = await CategoriesService.listCategories();
        res.json(categories);
    } catch (error) {
        logger.error('List categories error:', error);
        res.status(500).json({ error: 'Failed to list categories' });
    }
});

/**
 * @route   GET /api/categories/:idOrSlug
 * @desc    Get category detail with patterns and problems
 * @access  Public
 */
router.get('/:idOrSlug', async (req, res) => {
    try {
        const category = await CategoriesService.getCategory(req.params.idOrSlug);
        res.json(category);
    } catch (error) {
        logger.error('Get category error:', error);
        res.status(500).json({ error: 'Failed to get category' });
    }
});

/**
 * @route   GET /api/categories/:id/patterns
 * @desc    List patterns for a category
 * @access  Public
 */
router.get('/:id/patterns', async (req, res) => {
    try {
        const patterns = await CategoriesService.listPatterns(req.params.id);
        res.json(patterns);
    } catch (error) {
        logger.error('List patterns error:', error);
        res.status(500).json({ error: 'Failed to list patterns' });
    }
});

export default router;
