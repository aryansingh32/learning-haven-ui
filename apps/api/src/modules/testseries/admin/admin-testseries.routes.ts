import { Router } from 'express';
import {
  AdminExamCategoriesController,
  AdminTestSeriesController,
  AdminTestsController,
  AdminQuestionBankController,
} from './admin-testseries.controller';

// Mounted at /api/admin/test-series inside admin.ts, which already applies
// authenticateUser + requireAdmin + adminLogging at the router level.
const router = Router();

// ── Exam Categories ──
router.get('/exam-categories', AdminExamCategoriesController.list);
router.post('/exam-categories', AdminExamCategoriesController.create);
router.patch('/exam-categories/:id', AdminExamCategoriesController.update);
router.delete('/exam-categories/:id', AdminExamCategoriesController.remove);

// ── Series ──
router.get('/series', AdminTestSeriesController.list);
router.get('/series/:id', AdminTestSeriesController.get);
router.post('/series', AdminTestSeriesController.create);
router.patch('/series/:id', AdminTestSeriesController.update);
router.delete('/series/:id', AdminTestSeriesController.remove);

// ── Tests ──
router.get('/tests', AdminTestsController.list);
router.get('/tests/:id', AdminTestsController.get);
router.post('/tests', AdminTestsController.create);
router.patch('/tests/:id', AdminTestsController.update);
router.delete('/tests/:id', AdminTestsController.remove);

// ── Test sections ──
router.post('/tests/:id/sections', AdminTestsController.addSection);
router.patch('/sections/:sectionId', AdminTestsController.updateSection);
router.delete('/sections/:sectionId', AdminTestsController.removeSection);

// ── Test <-> question assignment ──
router.post('/tests/:id/questions', AdminTestsController.attachQuestion);
router.patch('/tests/:id/questions/reorder', AdminTestsController.reorderQuestions);
router.delete('/tests/:id/questions/:questionId', AdminTestsController.detachQuestion);

// ── Question bank ──
router.get('/questions', AdminQuestionBankController.list);
router.get('/questions/topics', AdminQuestionBankController.listTopics);
router.get('/questions/:id', AdminQuestionBankController.get);
router.post('/questions', AdminQuestionBankController.create);
router.patch('/questions/:id', AdminQuestionBankController.update);
router.delete('/questions/:id', AdminQuestionBankController.remove);

export default router;
