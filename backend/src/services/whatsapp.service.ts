import axios from 'axios';
import { supabase } from '../config/database';
import { JobsService } from './jobs.service';
import { AIService } from './ai.service';
import logger from '../config/logger';

const WA_API_URL = process.env.WHATSAPP_API_URL || '';
const WA_TOKEN = process.env.WHATSAPP_TOKEN || '';
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_ID || '';

export class WhatsAppService {
    /**
     * Send a text message via WhatsApp Cloud API
     */
    static async sendMessage(to: string, message: string): Promise<void> {
        if (!WA_TOKEN || !WA_PHONE_ID) {
            logger.warn('WhatsApp credentials not configured. Skipping send.', { to, message });
            return;
        }
        try {
            await axios.post(
                `${WA_API_URL}/${WA_PHONE_ID}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to,
                    type: 'text',
                    text: { body: message },
                },
                {
                    headers: {
                        Authorization: `Bearer ${WA_TOKEN}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
        } catch (err: any) {
            logger.error('WhatsApp send error:', { to, error: err.message });
        }
    }

    /**
     * Look up a user by their WhatsApp phone number
     */
    static async getUserByPhone(phone: string) {
        const normalized = phone.replace(/\D/g, '');
        const { data } = await supabase
            .from('users')
            .select('id, full_name, current_plan, phone_number')
            .or(`phone_number.eq.${normalized},phone_number.eq.+${normalized}`)
            .maybeSingle();
        return data;
    }

    /**
     * Handle incoming WhatsApp text messages (commands)
     */
    static async handleIncomingMessage(from: string, body: string): Promise<string> {
        const text = body.trim().toLowerCase();
        const user = await this.getUserByPhone(from);

        if (!user) {
            return `You don't seem to be registered on DSA OS. Sign up at https://dsaos.app to start your journey! 🚀`;
        }

        // --- Command: /progress ---
        if (text === '/progress' || text === 'progress') {
            const { data: progress } = await supabase
                .from('user_chapter_progress')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('completed', true);

            const { data: profile } = await supabase
                .from('users')
                .select('current_streak')
                .eq('id', user.id)
                .single();

            return `📊 *Progress Update for ${user.full_name}*\n\n✅ Chapters completed: ${(progress as any)?.length || 0}\n🔥 Current streak: ${profile?.current_streak || 0} days\n\nKeep going! 💪`;
        }

        // --- Command: /streak ---
        if (text === '/streak' || text === 'streak') {
            const { data: profile } = await supabase
                .from('users')
                .select('current_streak, longest_streak')
                .eq('id', user.id)
                .single();

            return `🔥 *Streak Report*\nCurrent: ${profile?.current_streak || 0} days\nLongest: ${profile?.longest_streak || 0} days\n\nDon't break the chain! 💪`;
        }

        // --- Command: /jobs ---
        if (text === '/jobs' || text === 'jobs') {
            const jobs = await JobsService.getLatestJobs(3);
            if (!jobs.length) return '📋 No new opportunities today. Check back tomorrow!';

            const lines = jobs.map((j: any) => `• *${j.title}* @ ${j.company} — ${j.type}\n  Apply: ${j.apply_url}`);
            return `💼 *Latest Opportunities*\n\n${lines.join('\n\n')}`;
        }

        // --- Command: doubt: <question> ---
        if (text.startsWith('doubt:') || text.startsWith('doubt ')) {
            const plan = user.current_plan || 'basic';
            if (plan !== 'pro-monthly' && plan !== 'pro-yearly' && plan !== 'admin') {
                return `🔒 AI Doubt Solver is a *Pro* feature. Upgrade at https://dsaos.app/pricing to unlock it!`;
            }
            const question = body.substring(body.indexOf(':') + 1).trim() || body.substring(6).trim();
            if (!question) return 'Please ask your question after "doubt: "';

            try {
                const aiRes = await AIService.chat(user.id, question);
                return `🤖 *AI Coach says:*\n\n${aiRes.reply}`;
            } catch (err: any) {
                return `Sorry, the AI is taking a break. Try again in a minute! 😅`;
            }
        }

        // --- Default help message ---
        return `👋 Hi ${user.full_name}! Here's what you can do:\n\n• */progress* — See your chapter progress\n• */streak* — Check your streak\n• */jobs* — Latest job opportunities\n• *doubt: <your question>* — Ask AI (Pro only)\n\nOpen the app anytime at https://dsaos.app 🚀`;
    }

    /**
     * Send morning task reminder to all active users
     */
    static async sendMorningReminders(): Promise<void> {
        logger.info('Sending morning task reminders...');
        try {
            const { data: users } = await supabase
                .from('users')
                .select('id, full_name, phone_number, current_streak')
                .not('phone_number', 'is', null)
                .eq('whatsapp_notifications', true);

            if (!users?.length) return;

            for (const user of users) {
                // Get their next chapter
                const { data: nextChapter } = await supabase
                    .from('user_chapter_progress')
                    .select('chapter_id, chapters(title)')
                    .eq('user_id', user.id)
                    .eq('completed', false)
                    .order('created_at', { ascending: true })
                    .limit(1)
                    .maybeSingle();

                const chapterTitle = (nextChapter as any)?.chapters?.title || 'your next chapter';
                const streak = user.current_streak || 0;
                const streakMsg = streak > 0 ? `You're on a *${streak}-day streak* — keep it going! 🔥` : 'Start your streak today! 🔥';

                await this.sendMessage(
                    user.phone_number,
                    `Good morning, ${user.full_name?.split(' ')[0] || 'friend'}! ☀️\n\nToday's task: *${chapterTitle}* is waiting for you.\n${streakMsg}\n\nOpen the app: https://dsaos.app`
                );
            }
            logger.info(`Sent morning reminders to ${users.length} users.`);
        } catch (err) {
            logger.error('Morning reminder error:', err);
        }
    }

    /**
     * Send afternoon job alert to all opted-in users
     */
    static async sendAfternoonJobAlerts(): Promise<void> {
        logger.info('Sending afternoon job alerts...');
        try {
            const jobs = await JobsService.getLatestJobs(2);
            if (!jobs.length) return;

            const { data: users } = await supabase
                .from('users')
                .select('phone_number')
                .not('phone_number', 'is', null)
                .eq('whatsapp_notifications', true);

            if (!users?.length) return;

            const lines = jobs.map((j: any) => `• *${j.title}* @ ${j.company}`).join('\n');
            const message = `💼 *Job Alert!*\n\nNew opportunities just posted:\n${lines}\n\nView & apply: https://dsaos.app/jobs`;

            for (const user of users) {
                await this.sendMessage(user.phone_number, message);
            }
        } catch (err) {
            logger.error('Afternoon job alert error:', err);
        }
    }

    /**
     * Send evening check-in to all active users
     */
    static async sendEveningCheckin(): Promise<void> {
        logger.info('Sending evening check-in messages...');
        try {
            const { data: users } = await supabase
                .from('users')
                .select('id, full_name, phone_number')
                .not('phone_number', 'is', null)
                .eq('whatsapp_notifications', true);

            if (!users?.length) return;

            for (const user of users) {
                await this.sendMessage(
                    user.phone_number,
                    `Evening check-in! 🌙\n\nDid you complete today's task, ${user.full_name?.split(' ')[0] || 'friend'}?\n\nReply *YES* to mark it done, or open the app: https://dsaos.app`
                );
            }
        } catch (err) {
            logger.error('Evening check-in error:', err);
        }
    }
}
