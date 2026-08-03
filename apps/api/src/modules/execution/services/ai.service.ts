import { SYSTEM_PROMPT } from '../../../config/openai';
import { supabase } from '../../../config/database';
import { CacheService } from '../../core/services/cache.service';
import logger from '../../../config/logger';
import { AIProviderService, AIConfig } from './ai-provider.service';
import { Response } from 'express';
import { env } from '../../../config/env';

// Rate limits by plan (queries per month)
const PLAN_LIMITS: Record<string, number> = {
    free: 5,
    'basic-monthly': 50,
    'basic-yearly': 50,
    'pro-monthly': -1, // unlimited
    'pro-yearly': -1,
};

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
            const canQuery = await this.checkRateLimit(userId);
            if (!canQuery) {
                throw new Error('AI query limit reached for your plan. Upgrade to continue.');
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

            await this.incrementUsage(userId);
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
        const limit = await this.getUserLimit(userId);
        if (limit === -1) return { remaining: -1, limit: -1, unlimited: true };

        const used = await this.getMonthlyUsage(userId);

        return {
            remaining: Math.max(0, limit - used),
            used,
            limit,
            unlimited: false,
        };
    }

    /**
     * Check if user can make an AI query
     */
    private static async checkRateLimit(userId: string): Promise<boolean> {
        const limit = await this.getUserLimit(userId);
        if (limit === -1) return true; // unlimited

        const used = await this.getMonthlyUsage(userId);
        return used < limit;
    }

    /**
     * Get user's plan limit
     */
    private static async getUserLimit(userId: string): Promise<number> {
        const { data: user } = await supabase
            .from('users')
            .select('current_plan')
            .eq('id', userId)
            .single();

        const plan = user?.current_plan || 'free';
        if (plan === 'free') {
            const config = await this.getAIConfig();
            return config.freeTierLimit !== undefined ? config.freeTierLimit : 50;
        }
        return PLAN_LIMITS[plan] ?? 50;
    }

    /**
     * Get monthly usage count
     */
    private static async getMonthlyUsage(userId: string): Promise<number> {
        const cacheKey = `ai:usage:${userId}:${new Date().toISOString().slice(0, 7)}`;
        const cached = await CacheService.get<number>(cacheKey);
        if (cached !== null) return cached;

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count } = await supabase
            .from('ai_chats')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('role', 'user')
            .gte('created_at', startOfMonth.toISOString());

        const usage = count || 0;
        await CacheService.set(cacheKey, usage, 3600);

        return usage;
    }

    /**
     * Increment monthly usage counter
     */
    private static async incrementUsage(userId: string) {
        const cacheKey = `ai:usage:${userId}:${new Date().toISOString().slice(0, 7)}`;
        await CacheService.del(cacheKey); // invalidate cache
    }
}
