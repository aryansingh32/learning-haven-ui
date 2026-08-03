import { Router } from 'express';
import { CertificatesController } from '../controllers/certificates.controller';
import { authenticateUser } from '../../../middleware/auth';
import { validate } from '../../../middleware/validate';
import { generateCertificateSchema } from '../../../utils/validators';
import { requireIdempotencyKey } from '../../../middleware/idempotency';
import { writeRateLimit } from '../../../middleware/rateLimit';
import { requireEntitlement } from '../../entitlements/entitlements.middleware';

const router = Router();

/**
 * @route   POST /api/certificates/generate
 * @desc    Generate certificate for a completed topic
 * @access  Private
 */
router.post(
    '/generate',
    authenticateUser,
    requireEntitlement('certificates_access'),
    writeRateLimit,
    requireIdempotencyKey,
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
