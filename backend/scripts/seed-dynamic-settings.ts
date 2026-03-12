import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function seedSettings() {
    const defaultSettings = [
        {
            key: 'onboarding_steps',
            category: 'general',
            description: 'Dynamic steps and questions for user onboarding flow',
            value: [
                {
                    id: 'year',
                    question: 'Which year are you in?',
                    options: [
                        { label: '1st Year', value: '1st Year' },
                        { label: '2nd Year', value: '2nd Year' },
                        { label: '3rd Year', value: '3rd Year' },
                        { label: '4th Year / Alumni', value: '4th Year / Alumni' },
                    ],
                },
                {
                    id: 'goal',
                    question: 'What is your main goal?',
                    options: [
                        { label: 'Get a Job', value: 'Get a Job' },
                        { label: 'Get an Internship', value: 'Get an Internship' },
                        { label: 'Clear College Exams', value: 'Clear College Exams' },
                        { label: 'All Three', value: 'All Three' },
                    ],
                },
                {
                    id: 'hours',
                    question: 'How many hours can you study per day?',
                    options: [
                        { label: 'Less than 1 hour', value: 'Less than 1 hour' },
                        { label: '1-2 hours', value: '1-2 hours' },
                        { label: '3-4 hours', value: '3-4 hours' },
                        { label: '5+ hours', value: '5+ hours' },
                    ],
                },
                {
                    id: 'language',
                    question: 'Choose your programming language:',
                    options: [
                        { label: 'Java', value: 'Java', icon: '☕' },
                        { label: 'C++', value: 'C++', icon: '⚡' },
                        { label: 'Python', value: 'Python', icon: '🐍' },
                        { label: 'JavaScript', value: 'JavaScript', icon: '🌐' },
                    ],
                },
            ]
        },
        {
            key: 'app_quick_actions',
            category: 'general',
            description: 'Quick action buttons on dashboard',
            value: [
                { label: "Start Tasks", icon: "Zap", to: "/topics", desc: "Continue learning" },
                { label: "Visualizer", icon: "Eye", to: "/visualizer", desc: "Watch algorithms" },
                { label: "Ask AI", icon: "Bot", to: "/ai-coach", desc: "Get instant help" },
                { label: "Roadmap", icon: "Map", to: "/topics", desc: "Your learning path" }
            ]
        },
        {
            key: 'ai_quick_actions',
            category: 'ai',
            description: 'Quick prompt suggestions for AI Coach',
            value: [
                { label: "Explain", icon: "Lightbulb", color: "text-primary" },
                { label: "Debug", icon: "Bug", color: "text-destructive" },
                { label: "Hint", icon: "HelpCircle", color: "text-info" },
                { label: "Summarize", icon: "FileText", color: "text-success" }
            ]
        }
    ];

    for (const setting of defaultSettings) {
        const { error } = await supabase
            .from('system_settings')
            .upsert(setting, { onConflict: 'key' });

        if (error) {
            console.error(`Failed to seed ${setting.key}:`, error.message);
        } else {
            console.log(`Seeded ${setting.key}`);
        }
    }

    console.log('Dynamic settings seeded successfully!');
}

seedSettings().catch(console.error);
