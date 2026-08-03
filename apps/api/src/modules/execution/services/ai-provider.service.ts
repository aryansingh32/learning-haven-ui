import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import logger from '../../../config/logger';
import { circuitBreakers } from '../../../reliability/circuitBreaker';

export interface AIConfig {
    activeProvider: string;
    model: string;
    openrouterKey: string;
    openaiKey: string;
    anthropicKey: string;
    grokKey: string;
    freeTierLimit?: number;
}

export class AIProviderService {
    static async getStream(
        messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
        config: AIConfig
    ): Promise<AsyncIterable<any>> {
        const providers = [
            config.activeProvider,
            'openrouter',
            'openai',
            'anthropic',
            'grok',
        ].filter((v, i, a) => a.indexOf(v) === i); // Unique ordered list starting with active provider

        for (const provider of providers) {
            try {
                logger.info(`Attempting AI generation with provider: ${provider}`);
                switch (provider) {
                    case 'openrouter':
                        if (config.openrouterKey) {
                            // The @openrouter/sdk appears to throw Zod validation errors.
                            // We fallback to the standard OpenAI client which perfectly mirrors the OpenRouter API.
                            const openrouter = new OpenAI({
                                baseURL: 'https://openrouter.ai/api/v1',
                                apiKey: config.openrouterKey,
                                defaultHeaders: {
                                    'HTTP-Referer': 'https://learning-haven.com', // Optional but recommended by OR
                                    'X-Title': 'Learning Haven',
                                }
                            });
                            return await circuitBreakers.openrouter.execute(() => openrouter.chat.completions.create({
                                model: config.model || 'openrouter/owl-alpha',
                                messages,
                                stream: true,
                            }));
                        }
                        break;
                    case 'openai':
                        if (config.openaiKey) {
                            const openaiClient = new OpenAI({ apiKey: config.openaiKey });
                            return await circuitBreakers.openai.execute(() => openaiClient.chat.completions.create({
                                model: config.model || 'gpt-4o-mini',
                                messages,
                                stream: true,
                            }));
                        }
                        break;
                    case 'anthropic':
                        if (config.anthropicKey) {
                            const anthropic = new Anthropic({ apiKey: config.anthropicKey });
                            return await circuitBreakers.anthropic.execute(() => anthropic.messages.create({
                                model: config.model || 'claude-3-haiku-20240307',
                                system: messages.find(m => m.role === 'system')?.content || '',
                                messages: messages.filter(m => m.role !== 'system') as any,
                                max_tokens: 1500,
                                stream: true,
                            }) as any);
                        }
                        break;
                    case 'grok':
                        if (config.grokKey) {
                            const grok = new OpenAI({
                                apiKey: config.grokKey,
                                baseURL: 'https://api.x.ai/v1',
                            });
                            return await circuitBreakers.grok.execute(() => grok.chat.completions.create({
                                model: config.model || 'grok-1',
                                messages,
                                stream: true,
                            }));
                        }
                        break;
                }
            } catch (error: any) {
                logger.warn(`Provider ${provider} failed: ${error.message}`);
                continue; // try next
            }
        }

        throw new Error('All configured AI providers failed or are missing API keys.');
    }

    static extractChunkContent(chunk: any, provider: string): string | undefined {
        if (!chunk) return undefined;

        if (provider === 'anthropic') {
            if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                return chunk.delta.text;
            }
            return undefined;
        }

        // OpenAI / OpenRouter / Grok format
        return chunk.choices?.[0]?.delta?.content;
    }
}
