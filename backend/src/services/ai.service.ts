import openai, { AI_MODEL, SYSTEM_PROMPT } from '../config/openai';
import { supabase } from '../config/database';
import { CacheService } from './cache.service';
import logger from '../config/logger';

// Rate limits by plan (queries per month)
const PLAN_LIMITS: Record<string, number> = {
    free: 5,
    'basic-monthly': 50,
    'basic-yearly': 50,
    'pro-monthly': -1, // unlimited
    'pro-yearly': -1,
};

export class AIService {
    /**
     * Send a message to the AI coach
     */
    static async chat(
        userId: string,
        message: string,
        problemId?: string
    ) {
        try {
            // Check rate limit
            const canQuery = await this.checkRateLimit(userId);
            if (!canQuery) {
                throw new Error('AI query limit reached for your plan. Upgrade to continue.');
            }

            // Get chat history for context (last 10 messages)
            const { data: history } = await supabase
                .from('ai_chats')
                .select('role, content')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(10);

            const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
                { role: 'system', content: SYSTEM_PROMPT },
            ];

            // Add problem context if provided
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

            // Add recent history (reversed to chronological)
            if (history && history.length > 0) {
                const recent = history.reverse();
                for (const msg of recent) {
                    messages.push({
                        role: msg.role as 'user' | 'assistant',
                        content: msg.content,
                    });
                }
            }

            // Add current message
            messages.push({ role: 'user', content: message });

            // Call OpenAI
            const completion = await openai.chat.completions.create({
                model: AI_MODEL,
                messages,
                max_tokens: 1500,
                temperature: 0.7,
            });

            const reply = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
            const tokensUsed = completion.usage?.total_tokens || 0;

            // Save both messages to DB
            await supabase.from('ai_chats').insert([
                {
                    user_id: userId,
                    role: 'user',
                    content: message,
                    problem_id: problemId || null,
                    tokens_used: 0,
                },
                {
                    user_id: userId,
                    role: 'assistant',
                    content: reply,
                    problem_id: problemId || null,
                    tokens_used: tokensUsed,
                },
            ]);

            // Increment usage counter
            await this.incrementUsage(userId);

            return {
                reply,
                tokens_used: tokensUsed,
                has_code: reply.includes('```'),
            };
        } catch (error: any) {
            logger.error('AI chat error:', { userId, error: error.message });
            throw error;
        }
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
        return PLAN_LIMITS[plan] ?? 5;
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
