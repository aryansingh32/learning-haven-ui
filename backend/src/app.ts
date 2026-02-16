import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { authenticateUser } from './middleware/auth';
import logger from './config/logger';

import routes from './routes';

const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(express.json());

// Routes
app.use('/api', routes);

app.get('/', (req, res) => {
    res.send('Learning Haven API v2.0 is running');
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected Route Example
app.get('/api/protected', authenticateUser, (req, res) => {
    res.json({ message: 'You are authenticated', user: (req as any).user });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error(err.stack);
    res.status(500).send('Something broke!');
});

export default app;
