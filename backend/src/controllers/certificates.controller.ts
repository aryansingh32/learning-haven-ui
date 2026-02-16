import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { CertificatesService } from '../services/certificates.service';
import logger from '../config/logger';

export class CertificatesController {
    /**
     * POST /api/certificates/generate
     */
    static async generate(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { topic } = req.body;

            const result = await CertificatesService.generateCertificate(userId, topic);
            res.json(result);
        } catch (error: any) {
            logger.error('Generate certificate error:', error);

            if (error.message?.includes('completed')) {
                return res.status(400).json({ error: error.message });
            }

            res.status(500).json({ error: 'Failed to generate certificate' });
        }
    }

    /**
     * GET /api/certificates
     */
    static async getUserCertificates(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const certs = await CertificatesService.getUserCertificates(userId);
            res.json(certs);
        } catch (error) {
            logger.error('Get certificates error:', error);
            res.status(500).json({ error: 'Failed to fetch certificates' });
        }
    }

    /**
     * GET /api/certificates/verify/:code
     */
    static async verify(req: Request, res: Response) {
        try {
            const code = req.params.code as string;
            const result = await CertificatesService.verifyCertificate(code);
            res.json(result);
        } catch (error) {
            logger.error('Verify certificate error:', error);
            res.status(500).json({ error: 'Failed to verify certificate' });
        }
    }
}
