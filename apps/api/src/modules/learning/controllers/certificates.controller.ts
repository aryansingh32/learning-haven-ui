import { Request, Response } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import { CertificatesService } from '../services/certificates.service';
import logger from '../../../config/logger';
import {
    ok,
    badRequest,
    serverError,
} from '../../../utils/api-response';

export class CertificatesController {
    /**
     * POST /api/certificates/generate
     */
    static async generate(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { topic } = req.body;

            const result = await CertificatesService.generateCertificate(userId, topic);
            return ok(res, result);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to generate certificate';
            logger.error('Generate certificate error:', error);

            if (message.includes('completed')) {
                return badRequest(res, message);
            }

            return serverError(res);
        }
    }

    /**
     * GET /api/certificates
     */
    static async getUserCertificates(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const certs = await CertificatesService.getUserCertificates(userId);
            return ok(res, certs);
        } catch (error) {
            logger.error('Get certificates error:', error);
            return serverError(res);
        }
    }

    /**
     * GET /api/certificates/verify/:code
     */
    static async verify(req: Request, res: Response) {
        try {
            const code = req.params.code as string;
            const result = await CertificatesService.verifyCertificate(code);
            return ok(res, result);
        } catch (error) {
            logger.error('Verify certificate error:', error);
            return serverError(res);
        }
    }
}
