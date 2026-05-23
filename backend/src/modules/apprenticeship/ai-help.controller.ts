import { Response } from 'express';
import redis from '../../config/redis';
import logger from '../../config/logger';
import { AuthRequest } from '../../middleware/auth';
import { supabase } from '../../config/database';
import { AIService } from '../../services/ai.service';
import { fail, ok } from './http';

export class AIHelpController {
  static async getHelp(req: AuthRequest, res: Response) {
    try {
      const { projectId, question, context } = req.body;
      const userId = req.user?.id;

      if (!projectId || !question) {
        return res.status(400).json(fail('projectId and question are required', 'E_AI_400'));
      }

      const { data: workspace, error: workspaceError } = await supabase
        .from('apprenticeship_project_progress')
        .select(`
          id,
          status,
          apprenticeship_projects!inner (
            id,
            title,
            description
          )
        `)
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .maybeSingle();

      if (workspaceError) throw workspaceError;
      if (!workspace || workspace.status === 'locked') {
        return res.status(403).json(fail('Project access denied', 'E_AI_403'));
      }

      const rateKey = `ai:apprenticeship:${userId}`;
      const currentCount = await redis.get(rateKey);
      const count = Number(currentCount || '0');
      if (count >= 10) {
        return res.status(429).json(fail('AI help rate limit exceeded. 10 queries per hour.', 'E_AI_429'));
      }

      const nextCount = await redis.incr(rateKey);
      if (nextCount === 1) {
        await redis.expire(rateKey, 3600);
      }

      const project = (workspace as any).apprenticeship_projects;
      const systemPrompt = `You are a helpful coding assistant for Learning Haven's apprenticeship program.
The student is working on: ${project?.title || 'Unknown Project'}
Project description: ${project?.description || 'No description provided'}
Their learning path: ${context?.learningPath || 'traditional'}
Current failing test: ${context?.lastError || 'none'}
Current stage: ${context?.currentStage || 'unknown'}

Help them fix the issue. Be specific, practical, and encouraging.
Provide code examples when relevant. Keep responses under 400 words.`;

      const response = await AIService.generateResponse(`${systemPrompt}\n\nStudent question:\n${question}`);
      const queriesRemaining = Math.max(0, 10 - nextCount);

      await supabase.from('apprenticeship_events').insert([
        {
          user_id: userId,
          session_id: req.headers['x-session-id'] || `ai:${userId}:${Date.now()}`,
          event_type: 'ai_help_query',
          event_category: 'ai',
          event_data: {
            project_id: projectId,
            question,
            context: context || {},
          },
          page_url: typeof req.headers.referer === 'string' ? req.headers.referer : null,
          ip_address: req.ip,
          user_agent: req.headers['user-agent'] || null,
          project_id: projectId,
        },
        {
          user_id: userId,
          session_id: req.headers['x-session-id'] || `ai:${userId}:${Date.now()}`,
          event_type: 'ai_help_response',
          event_category: 'ai',
          event_data: {
            project_id: projectId,
            response_preview: response.slice(0, 240),
            queries_remaining: queriesRemaining,
          },
          page_url: typeof req.headers.referer === 'string' ? req.headers.referer : null,
          ip_address: req.ip,
          user_agent: req.headers['user-agent'] || null,
          project_id: projectId,
        },
      ]);

      res.json(ok({
        response,
        queriesRemaining,
      }));
    } catch (error) {
      logger.error('Error providing apprenticeship AI help:', error);
      res.status(500).json(fail('Failed to get AI help', 'E_AI_500'));
    }
  }
}
