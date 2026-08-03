import { Router } from 'express';
import { authenticateUser } from '../../middleware/auth';
import { PlansController } from './plans.controller';

const router = Router();

router.get('/', PlansController.getPlansWithContent);
router.get('/my', authenticateUser, PlansController.getMyPlan);

export default router;
