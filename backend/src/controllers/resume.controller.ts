import { Request, Response } from 'express';
import { AiService } from '../services/ai.service';
import logger from '../config/logger';

export class ResumeController {
    static async improveText(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            const { text, context } = req.body;

            if (!text || text.trim().length === 0) {
                return res.status(400).json({ error: 'Text to improve is required' });
            }

            // Check role based on token (assuming standard or pro is required)
            const userRole = req.user?.role || 'basic';
            if (userRole !== 'pro' && userRole !== 'standard' && userRole !== 'admin') {
                return res.status(403).json({ error: 'Resume AI enhancer requires Standard or Pro plan.' });
            }

            const prompt = `You are an expert technical recruiter and resume writer. 
I have a resume bullet point that needs improvement to pass ATS filters and impress hiring managers.
Make it start with a strong action verb, quantify the impact if implicitly there, and structure it professionally.
Keep it strictly to ONE sentence, very concise. Do not add any conversational text, just return the improved bullet point.

Context/Role: ${context || 'General experience'}
Original text: ${text}

Improved bullet point:`;

            const improvedText = await AiService.generateResponse(prompt);

            res.json({ improvedText: improvedText.trim() });
        } catch (error: any) {
            logger.error('Improve resume text error:', error);
            res.status(500).json({ error: error.message || 'Failed to improve text' });
        }
    }
}
