// IMPORTANT: env validation MUST be the first import.
// It loads dotenv and crashes immediately if any required var is missing.
import { env } from './config/env';

import app from './app';
import logger from './config/logger';
import { VerificationService } from './modules/execution/services/verification.service';

const PORT = env.PORT;

// Bootstrap domain event subscribers before accepting requests
VerificationService.bootstrap();

// A stray rejected promise (e.g. a fire-and-forget DB write) must not take
// the whole API down for every user.
process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', {
        error: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
    });
});

app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
});
