import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import helmet from 'helmet';
import { requireUser } from './auth';
import { requireActiveCollege } from './collegeStatus';
import { moduleSwitch, rejectSuspended } from './controls';
import { allowOrigin } from './env';
import { errorHandler, HttpError } from './errors';
import { analyticsRouter } from './routes/analytics';
import { assignmentsRouter } from './routes/assignments';
import { communityRouter } from './routes/community';
import { contentRouter } from './routes/content';
import { drivesRouter } from './routes/drives';
import { env } from './env';
import { runScheduler } from './services/notify';
import { courseAssignmentsRouter, orgCoursesRouter } from './routes/courses';
import { meRouter } from './routes/me';
import { orgRouter } from './routes/org';
import { platformRouter } from './routes/platform';
import { publicRouter } from './routes/public';
import { studentRouter } from './routes/student';
import { testsRouter } from './routes/tests';

export const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: allowOrigin, credentials: false, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }));
app.use(express.json({ limit: '3mb' })); // roster CSVs travel as JSON text

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Reminders and email, for a cron service (or a timer in server.ts). Not a user route.
app.post('/campus/internal/scheduler', async (req, res) => {
  if (!env.CRON_SECRET || req.header('x-cron-secret') !== env.CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  res.json(await runScheduler());
});

// Before sign-in: a college's name and branding for its portal address (vit.forge.com).
app.use('/campus/v1/public', publicRouter);

const api = express.Router();
api.use(requireUser, rejectSuspended);
api.use('/me', meRouter);
api.use('/my', studentRouter);
api.use('/platform', platformRouter);
api.use('/orgs/:orgId', requireActiveCollege);
api.use('/orgs/:orgId', orgRouter);
api.use('/orgs/:orgId/tests', testsRouter);
api.use('/orgs/:orgId/assignments', assignmentsRouter);
api.use('/orgs/:orgId/courses', orgCoursesRouter);
api.use('/orgs/:orgId/analytics', analyticsRouter);
api.use('/orgs/:orgId/drives', drivesRouter);
api.use('/orgs/:orgId/course-assignments', courseAssignmentsRouter);
api.use('/orgs/:orgId/content', contentRouter);
// The college's community (students and staff of that college).
api.use('/community/:orgId', moduleSwitch('module.community'), communityRouter);
app.use('/campus/v1', api);

app.use((_req, _res, next) => next(new HttpError(404, 'Not found')));
app.use(errorHandler);
