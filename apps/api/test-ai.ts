import { AIService } from './src/modules/execution/services/ai.service';
import { AIProviderService } from './src/modules/execution/services/ai-provider.service';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    try {
        console.log('Testing AI Service getAIConfig...');
        const config = await (AIService as any).getAIConfig();
        console.log('Config:', { ...config, openrouterKey: config.openrouterKey ? 'REDACTED' : 'EMPTY' });

        console.log('Testing AIProviderService stream...');
        const stream = await AIProviderService.getStream([{ role: 'user', content: 'Hello' }], config);
        console.log('Stream acquired');
        
        let reply = '';
        for await (const chunk of stream) {
            const text = AIProviderService.extractChunkContent(chunk, config.activeProvider);
            if (text) {
                process.stdout.write(text);
                reply += text;
            }
        }
        console.log('\nFinished:', reply);
    } catch (e: any) {
        console.error('\nCaught Error:', e.message);
        console.error(e.stack);
    }
    process.exit(0);
}
test();
