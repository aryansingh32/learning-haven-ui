import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import helmet from 'helmet';
import { requireUser } from './auth';
import { corsOrigins } from './env';
import { errorHandler, HttpError } from './errors';
import { assignmentsRouter } from './routes/assignments';
import { meRouter } from './routes/me';
import { orgRouter } from './routes/org';
import { studentRouter } from './routes/student';
import { testsRouter } from './routes/tests';

export const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: corsOrigins, credentials: false, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }));
app.use(express.json({ limit: '3mb' })); // roster CSVs travel as JSON text

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const api = express.Router();
api.use(requireUser);
api.use('/me', meRouter);
api.use('/my', studentRouter);
api.use('/orgs/:orgId', orgRouter);
api.use('/orgs/:orgId/tests', testsRouter);
api.use('/orgs/:orgId/assignments', assignmentsRouter);
app.use('/campus/v1', api);

app.use((_req, _res, next) => next(new HttpError(404, 'Not found')));
app.use(errorHandler);
