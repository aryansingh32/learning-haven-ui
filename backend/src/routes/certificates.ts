import { Router } from 'express';
import { CertificatesController } from '../controllers/certificates.controller';
import { authenticateUser } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { generateCertificateSchema } from '../utils/validators';

const router = Router();

/**
 * @route   POST /api/certificates/generate
 * @desc    Generate certificate for a completed topic
 * @access  Private
 */
router.post(
    '/generate',
    authenticateUser,
    validate(generateCertificateSchema),
    CertificatesController.generate
);

/**
 * @route   GET /api/certificates
 * @desc    Get user's certificates
 * @access  Private
 */
router.get('/', authenticateUser, CertificatesController.getUserCertificates);

/**
 * @route   GET /api/certificates/verify/:code
 * @desc    Verify a certificate by code
 * @access  Public
 */
router.get('/verify/:code', CertificatesController.verify);

export default router;
