import app from './app';
import dotenv from 'dotenv';
import logger from './config/logger';

dotenv.config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
});
