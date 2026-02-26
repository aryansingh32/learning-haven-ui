import { supabase } from '../config/database';
import logger from '../config/logger';
import { updateStreak } from '../utils/streak';
import { checkBadges } from '../utils/badges';

export class ChaptersService {
    static async getChapterWithProgress(userId: string, chapterId: string) {
        try {
            const { data: chapter, error: chapterError } = await supabase
                .from('chapters')
                .select('*')
                .eq('id', chapterId)
                .single();

            if (chapterError || !chapter) {
                throw chapterError || new Error('Chapter not found');
            }

            const { data: content, error: contentError } = await supabase
                .from('chapter_content')
                .select('*')
                .eq('chapter_id', chapterId)
                .maybeSingle();

            if (contentError) {
                throw contentError;
            }

            let { data: progress, error: progressError } = await supabase
                .from('user_chapter_progress')
                .select('*')
                .eq('user_id', userId)
                .eq('chapter_id', chapterId)
                .maybeSingle();

            if (progressError && progressError.code !== 'PGRST116') {
                throw progressError;
            }

            if (!progress) {
                const defaultStatus = chapter.chapter_number === 1 ? 'UNLOCKED' : 'LOCKED';
                const insertPayload = {
                    user_id: userId,
                    chapter_id: chapterId,
                    status: defaultStatus,
                    unlocked_at: defaultStatus === 'UNLOCKED' ? new Date().toISOString() : null,
                };

                const { data: inserted, error: insertError } = await supabase
                    .from('user_chapter_progress')
                    .insert(insertPayload)
                    .select('*')
                    .single();

                if (insertError) {
                    throw insertError;
                }

                progress = inserted;
            }

            return {
                chapter,
                content,
                progress,
            };
        } catch (error) {
            logger.error('Get chapter with progress error:', { userId, chapterId, error });
            throw new Error('Failed to fetch chapter');
        }
    }

    static async getRoadmapChaptersForUser(userId: string, roadmapId: string) {
        try {
            const { data: chapters, error } = await supabase
                .from('chapters')
                .select('*')
                .eq('roadmap_id', roadmapId)
                .order('chapter_number', { ascending: true });

            if (error) throw error;

            if (!chapters || chapters.length === 0) {
                return [];
            }

            const chapterIds = chapters.map(c => c.id);

            const { data: progressRows, error: progressError } = await supabase
                .from('user_chapter_progress')
                .select('*')
                .eq('user_id', userId)
                .in('chapter_id', chapterIds);

            if (progressError) {
                throw progressError;
            }

            const progressByChapter = new Map<string, any>();
            (progressRows || []).forEach(row => {
                progressByChapter.set(row.chapter_id, row);
            });

            return chapters.map(chapter => {
                const prog = progressByChapter.get(chapter.id);
                return {
                    ...chapter,
                    status: prog?.status || (chapter.chapter_number === 1 ? 'UNLOCKED' : 'LOCKED'),
                };
            });
        } catch (error) {
            logger.error('Get roadmap chapters error:', { userId, roadmapId, error });
            throw new Error('Failed to fetch roadmap chapters');
        }
    }

    static async updateQuizProgress(userId: string, chapterId: string, score: number, passed: boolean) {
        try {
            const percentScore = Math.round((score / 3) * 100);

            const { data: existing, error: fetchError } = await supabase
                .from('user_chapter_progress')
                .select('id, quiz_attempts, tasks_completed')
                .eq('user_id', userId)
                .eq('chapter_id', chapterId)
                .maybeSingle();

            if (fetchError && fetchError.code !== 'PGRST116') {
                throw fetchError;
            }

            const attempts = (existing?.quiz_attempts || 0) + 1;
            const tasksCompleted = existing?.tasks_completed || 0;

            const payload: any = {
                quiz_score: percentScore,
                quiz_attempts: attempts,
                updated_at: new Date().toISOString(),
            };

            if (!existing) {
                payload.user_id = userId;
                payload.chapter_id = chapterId;
            }

            const query = supabase.from('user_chapter_progress');

            if (existing) {
                const { error: updateError } = await query
                    .update(payload)
                    .eq('id', existing.id);
                if (updateError) throw updateError;
            } else {
                const { error: insertError } = await query.insert(payload);
                if (insertError) throw insertError;
            }

            const canUnlock = passed && tasksCompleted >= 1;

            return {
                success: true,
                quiz_score: percentScore,
                can_unlock: canUnlock,
            };
        } catch (error) {
            logger.error('Update quiz progress error:', { userId, chapterId, error });
            throw new Error('Failed to update quiz progress');
        }
    }

    static async updateTaskProgress(userId: string, chapterId: string) {
        try {
            const { data: existing, error: fetchError } = await supabase
                .from('user_chapter_progress')
                .select('id, quiz_score')
                .eq('user_id', userId)
                .eq('chapter_id', chapterId)
                .maybeSingle();

            if (fetchError && fetchError.code !== 'PGRST116') {
                throw fetchError;
            }

            const payload: any = {
                tasks_completed: 1,
                updated_at: new Date().toISOString(),
            };

            if (!existing) {
                payload.user_id = userId;
                payload.chapter_id = chapterId;
                payload.status = 'IN_PROGRESS';
            }

            const query = supabase.from('user_chapter_progress');

            if (existing) {
                const { error: updateError } = await query
                    .update(payload)
                    .eq('id', existing.id);
                if (updateError) throw updateError;
            } else {
                const { error: insertError } = await query.insert(payload);
                if (insertError) throw insertError;
            }

            const quizScore = existing?.quiz_score || 0;
            const canUnlock = quizScore >= 66;

            return {
                success: true,
                can_unlock: canUnlock,
            };
        } catch (error) {
            logger.error('Update task progress error:', { userId, chapterId, error });
            throw new Error('Failed to update task progress');
        }
    }

    static async unlockChapter(userId: string, chapterId: string) {
        try {
            const { data: progress, error: progressError } = await supabase
                .from('user_chapter_progress')
                .select('*')
                .eq('user_id', userId)
                .eq('chapter_id', chapterId)
                .single();

            if (progressError || !progress) {
                throw progressError || new Error('Progress not found');
            }

            const quizOk = (progress.quiz_score || 0) >= 66;
            const taskOk = (progress.tasks_completed || 0) >= 1;

            if (!quizOk || !taskOk) {
                return {
                    error: 'Conditions not met',
                    quiz_ok: quizOk,
                    task_ok: taskOk,
                    statusCode: 400,
                };
            }

            const now = new Date().toISOString();

            const { error: completeError } = await supabase
                .from('user_chapter_progress')
                .update({
                    status: 'COMPLETED',
                    completed_at: now,
                    updated_at: now,
                })
                .eq('id', progress.id);

            if (completeError) throw completeError;

            const { data: chapter, error: chapterError } = await supabase
                .from('chapters')
                .select('id, title, chapter_number, roadmap_id')
                .eq('id', chapterId)
                .single();

            if (chapterError || !chapter) {
                throw chapterError || new Error('Chapter not found');
            }

            const nextNumber = (chapter.chapter_number || 0) + 1;

            const { data: next, error: nextError } = await supabase
                .from('chapters')
                .select('id, title, chapter_number')
                .eq('roadmap_id', chapter.roadmap_id)
                .eq('chapter_number', nextNumber)
                .maybeSingle();

            let nextChapter = null;

            if (next && next.id) {
                const { error: upsertError } = await supabase
                    .from('user_chapter_progress')
                    .upsert({
                        user_id: userId,
                        chapter_id: next.id,
                        status: 'UNLOCKED',
                        unlocked_at: now,
                        updated_at: now,
                    }, {
                        onConflict: 'user_id,chapter_id',
                    });

                if (upsertError) {
                    throw upsertError;
                }

                nextChapter = next;
            }

            const streakInfo = await updateStreak(userId);
            const badge = await checkBadges(userId);

            const webhookUrl = process.env.N8N_WEBHOOK_URL;
            if (webhookUrl) {
                // fire and forget
                try {
                    fetch(webhookUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            event: 'chapter_unlocked',
                            user_id: userId,
                            chapter_id: chapterId,
                            next_chapter_id: nextChapter?.id || null,
                        }),
                    }).catch(() => { /* ignore */ });
                } catch {
                    // ignore webhook failures
                }
            }

            return {
                success: true,
                next_chapter: nextChapter,
                streak: streakInfo,
                badge,
            };
        } catch (error) {
            logger.error('Unlock chapter error:', { userId, chapterId, error });
            throw new Error('Failed to unlock chapter');
        }
    }

    static async skipUnlockChapter(userId: string, chapterId: string) {
        try {
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('id, skip_tokens_remaining')
                .eq('id', userId)
                .single();

            if (userError || !user) {
                throw userError || new Error('User not found');
            }

            if (!user.skip_tokens_remaining || user.skip_tokens_remaining <= 0) {
                return {
                    error: 'No skip tokens remaining',
                    statusCode: 400,
                };
            }

            const now = new Date().toISOString();

            const { error: userUpdateError } = await supabase
                .from('users')
                .update({
                    skip_tokens_remaining: user.skip_tokens_remaining - 1,
                    updated_at: now,
                })
                .eq('id', userId);

            if (userUpdateError) {
                throw userUpdateError;
            }

            const { data: progress, error: progressError } = await supabase
                .from('user_chapter_progress')
                .select('id')
                .eq('user_id', userId)
                .eq('chapter_id', chapterId)
                .maybeSingle();

            if (progressError && progressError.code !== 'PGRST116') {
                throw progressError;
            }

            const { error: upsertError } = await supabase
                .from('user_chapter_progress')
                .upsert({
                    id: progress?.id,
                    user_id: userId,
                    chapter_id: chapterId,
                    used_skip_token: true,
                    status: 'COMPLETED',
                    completed_at: now,
                    updated_at: now,
                }, {
                    onConflict: 'user_id,chapter_id',
                });

            if (upsertError) {
                throw upsertError;
            }

            const { data: chapter, error: chapterError } = await supabase
                .from('chapters')
                .select('id, title, chapter_number, roadmap_id')
                .eq('id', chapterId)
                .single();

            if (chapterError || !chapter) {
                throw chapterError || new Error('Chapter not found');
            }

            const nextNumber = (chapter.chapter_number || 0) + 1;

            const { data: next, error: nextError } = await supabase
                .from('chapters')
                .select('id, title, chapter_number')
                .eq('roadmap_id', chapter.roadmap_id)
                .eq('chapter_number', nextNumber)
                .maybeSingle();

            let nextChapter = null;

            if (next && next.id) {
                const { error: nextProgressError } = await supabase
                    .from('user_chapter_progress')
                    .upsert({
                        user_id: userId,
                        chapter_id: next.id,
                        status: 'UNLOCKED',
                        unlocked_at: now,
                        updated_at: now,
                    }, {
                        onConflict: 'user_id,chapter_id',
                    });

                if (nextProgressError) {
                    throw nextProgressError;
                }

                nextChapter = next;
            }

            return {
                success: true,
                tokens_remaining: (user.skip_tokens_remaining || 0) - 1,
                next_chapter: nextChapter,
            };
        } catch (error) {
            logger.error('Skip unlock chapter error:', { userId, chapterId, error });
            throw new Error('Failed to skip unlock chapter');
        }
    }
}

