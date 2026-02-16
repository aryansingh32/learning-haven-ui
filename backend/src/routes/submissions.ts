import { Router } from 'express';
import { SubmissionsController } from '../controllers/submissions.controller';
import { authenticateUser } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { addNoteSchema, toggleRevisionSchema } from '../utils/validators';

const router = Router();

/**
 * @route   POST /api/submissions/:id/notes
 * @desc    Add notes to submission
 * @access  Private
 */
router.post(
    '/:id/notes',
    authenticateUser,
    validate(addNoteSchema),
    SubmissionsController.addNotes
);

/**
 * @route   POST /api/submissions/:id/revision
 * @desc    Toggle revision status
 * @access  Private
 */
router.post(
    '/:id/revision',
    authenticateUser,
    validate(toggleRevisionSchema),
    SubmissionsController.toggleRevision
);

/**
 * @route   GET /api/submissions/leaderboard
 * @desc    Get leaderboard
 * @access  Public (or Private)
 * @note    Commonly public, but let's keep it open or auth'd as needed.
 *          The user guide has it as GET /api/leaderboard in controller but mapped where?
 */
router.get('/leaderboard', SubmissionsController.getLeaderboard);

export default router;
