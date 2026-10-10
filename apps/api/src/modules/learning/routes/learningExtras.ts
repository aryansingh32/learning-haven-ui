import { Router } from 'express';
import { authenticateUser } from '../../../middleware/auth';
import { LearningExtrasController as C } from '../controllers/learningExtras.controller';

/** Mounted at /api/highlights. */
export const highlightsRouter = Router();
highlightsRouter.get('/chapter/:chapterId', authenticateUser, C.listHighlights);
highlightsRouter.post('/chapter/:chapterId', authenticateUser, C.createHighlight);
highlightsRouter.patch('/:id', authenticateUser, C.updateHighlight);
highlightsRouter.delete('/:id', authenticateUser, C.deleteHighlight);

/** Mounted at /api/discussion. */
export const discussionRouter = Router();
discussionRouter.get('/chapter/:chapterId', authenticateUser, C.listPosts);
discussionRouter.post('/chapter/:chapterId', authenticateUser, C.createPost);
discussionRouter.patch('/posts/:id', authenticateUser, C.editPost);
discussionRouter.delete('/posts/:id', authenticateUser, C.deletePost);
discussionRouter.post('/posts/:id/report', authenticateUser, C.reportPost);
discussionRouter.post('/posts/:id/moderate', authenticateUser, C.moderatePost);
