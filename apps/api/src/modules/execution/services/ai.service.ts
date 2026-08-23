import { SYSTEM_PROMPT } from '../../../config/openai';
import { supabase } from '../../../config/database';
import { CacheService } from '../../core/services/cache.service';
import logger from '../../../config/logger';
import { AIProviderService, AIConfig } from './ai-provider.service';
import { GamificationService } from '../../auth/services/gamification.service';
import { EntitlementsService } from '../../entitlements/entitlements.service';
import { Response } from 'express';
import { env } from '../../../config/env';

export class AIService {
    private static async getAIConfig(): Promise<AIConfig> {
        const { data } = await supabase.from('system_settings').select('key, value').eq('category', 'ai');
        const cfg: any = { 
            activeProvider: 'openrouter', 
            model: 'openrouter/owl-alpha', 
            openrouterKey: env.OPENROUTER_API_KEY || '', 
            openaiKey: env.OPENAI_API_KEY || '', 
            anthropicKey: '', 
            grokKey: '',
            freeTierLimit: 50
        };
        if (data) {
            for (const row of data) {
                let val = row.value;
                try { val = JSON.parse(val); } catch {}
                if (row.key === 'ai_active_provider' && val) cfg.activeProvider = val;
                if (row.key === 'ai_model' && val) cfg.model = val;
                if (row.key === 'ai_openrouter_key' && val) cfg.openrouterKey = val;
                if (row.key === 'ai_openai_key' && val) cfg.openaiKey = val;
                if (row.key === 'ai_anthropic_key' && val) cfg.anthropicKey = val;
                if (row.key === 'ai_grok_key' && val) cfg.grokKey = val;
                if (row.key === 'ai_free_tier_limit' && val !== undefined) cfg.freeTierLimit = Number(val);
            }
        }
        return cfg as AIConfig;
    }

    /**
     * Send a streaming message to the AI coach
     */
    static async chatStream(
        userId: string,
        message: string,
        res: Response,
        problemId?: string
    ) {
        try {
            // BUG-012 fix: route all quota checks through EntitlementsService (admin-controlled)
            // instead of the old hardcoded PLAN_LIMITS constant.
            const entCheck = await EntitlementsService.checkAndConsumeUsage(userId, 'ai_queries_per_day');
            if (!entCheck.allowed) {
                throw new Error(`AI limit reached (${entCheck.used}/${entCheck.limit} queries today). Upgrade your plan to continue.`);
            }

            const { data: history } = await supabase
                .from('ai_chats')
                .select('role, content')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(10);

            const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
                { role: 'system', content: SYSTEM_PROMPT },
            ];

            // BH-011: Inject learner context so the Mentor automatically knows the
            // learner's state — XP, streak, active course/chapter, weak areas, etc.
            // Previously getMentorContext() was only used for dashboard nudge cards
            // and never reached the LLM. This closes that gap.
            try {
                const ctx = await GamificationService.getMentorContext(userId);
                const ctxParts: string[] = [];

                if (ctx.context.courseTitle) {
                    ctxParts.push(`The student is enrolled in: "${ctx.context.courseTitle}".`);
                }
                if (ctx.context.activeChapter) {
                    ctxParts.push(`Currently working on chapter: "${ctx.context.activeChapter}".`);
                }
                if (ctx.context.lastCompletedChapter) {
                    ctxParts.push(`Last completed chapter: "${ctx.context.lastCompletedChapter}".`);
                }
                if (typeof ctx.context.streak === 'number') {
                    ctxParts.push(`Current streak: ${ctx.context.streak} day(s).`);
                }
                if (ctx.context.daysInactive !== null && ctx.context.daysInactive !== undefined) {
                    ctxParts.push(`Days since last active: ${ctx.context.daysInactive}.`);
                }
                if (ctx.scenario && ctx.message) {
                    ctxParts.push(`Contextual scenario: ${ctx.scenario}. Mentor nudge: "${ctx.message}"`);
                }

                if (ctxParts.length > 0) {
                    messages.push({
                        role: 'system',
                        content: `[Learner Context — use this to personalise your responses]\n${ctxParts.join(' ')}`,
                    });
                }
            } catch (ctxErr) {
                // Non-fatal: if context fetch fails, continue with static system prompt
                logger.warn('getMentorContext failed — continuing without learner context', ctxErr);
            }

            if (problemId) {
                const { data: problem } = await supabase
                    .from('problems')
                    .select('title, description, difficulty, topic, constraints, time_complexity, space_complexity')
                    .eq('id', problemId)
                    .single();

                if (problem) {
                    messages.push({
                        role: 'system',
                        content: `The student is working on: "${problem.title}" (${problem.difficulty}, ${problem.topic}). Description: ${problem.description}. Expected complexity: Time ${problem.time_complexity}, Space ${problem.space_complexity}.`,
                    });
                }
            }

            if (history && history.length > 0) {
                const recent = history.reverse();
                for (const msg of recent) {
                    messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
                }
            }

            messages.push({ role: 'user', content: message });

            const config = await this.getAIConfig();
            const stream = await AIProviderService.getStream(messages, config);

            let fullReply = '';
            for await (const chunk of stream) {
                const text = AIProviderService.extractChunkContent(chunk, config.activeProvider);
                if (text) {
                    fullReply += text;
                    res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
                }
            }
            res.write(`data: [DONE]\n\n`);
            res.end();

            const tokensUsed = Math.ceil(fullReply.length / 4) + Math.ceil(message.length / 4);

            await supabase.from('ai_chats').insert([
                { user_id: userId, role: 'user', content: message, problem_id: problemId || null, tokens_used: 0 },
                { user_id: userId, role: 'assistant', content: fullReply, problem_id: problemId || null, tokens_used: tokensUsed },
            ]);

            // Note: EntitlementsService.checkAndConsumeUsage already incremented the Redis counter.
            // We still insert the chat record above for history, so nothing extra needed here.
        } catch (error: any) {
            logger.error('AI chat error:', { userId, error: error.message });
            throw error;
        }
    }

    /**
     * One-shot text generation
     */
    static async generateResponse(prompt: string): Promise<string> {
        const config = await this.getAIConfig();
        const stream = await AIProviderService.getStream([{ role: 'user', content: prompt }], config);
        
        let fullReply = '';
        for await (const chunk of stream) {
            const text = AIProviderService.extractChunkContent(chunk, config.activeProvider);
            if (text) fullReply += text;
        }
        return fullReply;
    }

    /**
     * Get chat history
     */
    static async getChatHistory(userId: string, limit: number = 50) {
        try {
            const { data, error } = await supabase
                .from('ai_chats')
                .select('id, role, content, problem_id, tokens_used, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;

            return data?.reverse() || [];
        } catch (error) {
            logger.error('Get chat history error:', { userId, error });
            throw new Error('Failed to fetch chat history');
        }
    }

    /**
     * Clear chat history
     */
    static async clearHistory(userId: string) {
        try {
            await supabase
                .from('ai_chats')
                .delete()
                .eq('user_id', userId);

            return { message: 'Chat history cleared' };
        } catch (error) {
            logger.error('Clear history error:', { userId, error });
            throw new Error('Failed to clear chat history');
        }
    }

    /**
     * Get remaining queries for the month
     */
    static async getRemainingQueries(userId: string) {
        const entCheck = await EntitlementsService.checkEntitlement(userId, 'ai_queries_per_day');
        if (entCheck.limit === -1) return { remaining: -1, limit: -1, unlimited: true };

        return {
            remaining: entCheck.remaining ?? 0,
            used: entCheck.used ?? 0,
            limit: entCheck.limit ?? 0,
            unlimited: false,
        };
    }

}

