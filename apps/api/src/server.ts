// IMPORTANT: env validation MUST be the first import.
// It loads dotenv and crashes immediately if any required var is missing.
import { env } from './config/env';

import app from './app';
import logger from './config/logger';
import { VerificationService } from './modules/execution/services/verification.service';

const PORT = env.PORT;

// Bootstrap domain event subscribers before accepting requests
VerificationService.bootstrap();

app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
});
