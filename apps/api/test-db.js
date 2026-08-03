const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const settings = [
    { key: 'ai_active_provider', value: '"openrouter"', description: 'Primary AI provider', category: 'ai' },
    { key: 'ai_model', value: '"openrouter/owl-alpha"', description: 'Model to use', category: 'ai' },
    { key: 'ai_openrouter_key', value: '"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"', description: 'OpenRouter API Key', category: 'ai' },
    { key: 'ai_openai_key', value: '""', description: 'OpenAI API Key', category: 'ai' },
    { key: 'ai_anthropic_key', value: '""', description: 'Anthropic API Key', category: 'ai' },
    { key: 'ai_grok_key', value: '""', description: 'Grok API Key', category: 'ai' },
  ];

  for (const s of settings) {
    await supabase.from('system_settings').upsert({
      key: s.key,
      value: s.value,
      description: s.description,
      category: s.category,
      updated_at: new Date().toISOString()
    });
  }
  console.log('Seeded settings');
}
run().catch(console.error);
