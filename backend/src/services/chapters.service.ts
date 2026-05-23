import { supabase, pool } from '../config/database';
import logger from '../config/logger';
import { updateStreak } from '../utils/streak';
import { checkBadges } from '../utils/badges';

type StepRow = { type?: string; content?: Record<string, unknown> };

export class ChaptersService {
    static computeXpReward(estMinutes?: number | null): number {
        const minutes = Number(estMinutes) || 30;
        return Math.max(50, Math.min(350, Math.round(minutes * 1.5)));
    }

    static buildCelebrationMeta(chapter: { title?: string; topic_tag?: string; est_minutes?: number }, steps: StepRow[] = []) {
        const revisionStep = steps.find((s) => s.type === 'micro_revision' || s.type === 'complete');
        const content = (revisionStep?.content || {}) as Record<string, unknown>;
        const celebration = (content.completion_celebration || {}) as {
            message?: string;
            linkedin_card_text?: string;
        };
        const rewardChest = (content.reward_chest || {}) as { rewards?: string[] };
        const skills = [chapter.topic_tag, chapter.title].filter(Boolean) as string[];

        return {
            xp: ChaptersService.computeXpReward(chapter.est_minutes),
            badge_name: celebration.message || `${chapter.title || 'Chapter'} Master`,
            skills,
            linkedin_text:
                celebration.linkedin_card_text ||
                `Just completed "${chapter.title}" on Learning Haven! 🚀`,
            reward_options: rewardChest.rewards || [],
            identity_affirmation: (content.identity_affirmation as string) || null,
        };
    }

    static async getCelebrationSummary(userId: string, chapterId: string) {
        const chapterResult = await pool.query(
            'SELECT c.*, r.title AS roadmap_title FROM public.chapters c LEFT JOIN public.roadmaps r ON r.id = c.roadmap_id WHERE c.id = $1',
            [chapterId]
        );
        const chapter = chapterResult.rows[0];
        if (!chapter) {
            throw new Error('Chapter not found');
        }

        const stepsResult = await pool.query(
            'SELECT type, content FROM public.steps WHERE chapter_id = $1 ORDER BY step_number ASC',
            [chapterId]
        );

        const { data: user } = await supabase
            .from('users')
            .select('full_name, streak_count, xp, skip_tokens_remaining')
            .eq('id', userId)
            .maybeSingle();

        const progressResult = await pool.query(
            'SELECT * FROM public.user_chapter_progress WHERE user_id = $1 AND chapter_id = $2',
            [userId, chapterId]
        );
        const progress = progressResult.rows[0];

        const nextNumber = (chapter.chapter_number || 0) + 1;
        const nextResult = await pool.query(
            'SELECT id, title, chapter_number FROM public.chapters WHERE roadmap_id = $1 AND chapter_number = $2',
            [chapter.roadmap_id, nextNumber]
        );

        const meta = ChaptersService.buildCelebrationMeta(chapter, stepsResult.rows);

        return {
            chapter: {
                id: chapter.id,
                title: chapter.title,
                chapter_number: chapter.chapter_number,
                roadmap_title: chapter.roadmap_title,
            },
            celebration: meta,
            progress: {
                quiz_score: progress?.quiz_score ?? 0,
                tasks_completed: progress?.tasks_completed ?? 0,
                status: progress?.status ?? 'UNLOCKED',
                can_unlock:
                    (progress?.quiz_score || 0) >= 66 && (progress?.tasks_completed || 0) >= 1,
            },
            user: {
                full_name: user?.full_name || 'Learner',
                streak_day: user?.streak_count || 1,
                skip_tokens_remaining: user?.skip_tokens_remaining ?? 0,
            },
            next_chapter: nextResult.rows[0] || null,
        };
    }

    static async getChapterWithProgress(userId: string, chapterId: string) {
        try {
            const uuidRe =
                /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRe.test(chapterId)) {
                throw new Error('Chapter not found');
            }

            const chapterResult = await pool.query(
                `SELECT c.*, r.id AS roadmap_id_ref, r.title AS roadmap_title, r.slug AS roadmap_slug
                 FROM public.chapters c
                 LEFT JOIN public.roadmaps r ON r.id = c.roadmap_id
                 WHERE c.id = $1`,
                [chapterId]
            );
            const chapter = chapterResult.rows[0];

            if (!chapter) {
                throw new Error('Chapter not found');
            }

            const contentResult = await pool.query(
                'SELECT * FROM public.chapter_content WHERE chapter_id = $1',
                [chapterId]
            );
            const content = contentResult.rows[0];

            const stepsResult = await pool.query(
                'SELECT * FROM public.steps WHERE chapter_id = $1 ORDER BY step_number ASC',
                [chapterId]
            );
            const steps = stepsResult.rows;

            const progressResult = await pool.query(
                'SELECT * FROM public.user_chapter_progress WHERE user_id = $1 AND chapter_id = $2',
                [userId, chapterId]
            );
            let progress = progressResult.rows[0];

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

            const { data: user } = await supabase
                .from('users')
                .select('full_name, streak_count, skip_tokens_remaining')
                .eq('id', userId)
                .maybeSingle();

            const celebration = ChaptersService.buildCelebrationMeta(chapter, steps);

            return {
                chapter,
                roadmap: chapter.roadmap_title
                    ? {
                          id: chapter.roadmap_id,
                          title: chapter.roadmap_title,
                          slug: chapter.roadmap_slug,
                      }
                    : null,
                content: {
                    ...(content || {}),
                    steps: steps || [],
                },
                progress,
                celebration,
                user: {
                    full_name: user?.full_name || 'Learner',
                    streak_day: user?.streak_count || 1,
                    skip_tokens_remaining: user?.skip_tokens_remaining ?? 0,
                },
            };
        } catch (error) {
            logger.error('Get chapter with progress error:', { userId, chapterId, error });
            if (error instanceof Error && error.message === 'Chapter not found') {
                throw error;
            }
            throw new Error('Failed to fetch chapter');
        }
    }

    static async getRoadmapChaptersForUser(userId: string, roadmapId: string) {
        try {
            const chaptersResult = await pool.query(
                'SELECT * FROM public.chapters WHERE roadmap_id = $1 ORDER BY chapter_number ASC',
                [roadmapId]
            );
            const chapters = chaptersResult.rows;

            if (!chapters || chapters.length === 0) {
                return [];
            }

            const chapterIds = chapters.map(c => c.id);

            const progressResult = await pool.query(
                'SELECT * FROM public.user_chapter_progress WHERE user_id = $1 AND chapter_id = ANY($2)',
                [userId, chapterIds]
            );
            const progressRows = progressResult.rows;

            const stepCountsResult = await pool.query(
                `SELECT chapter_id, COUNT(*)::int AS step_count
                 FROM public.steps
                 WHERE chapter_id = ANY($1)
                 GROUP BY chapter_id`,
                [chapterIds]
            );
            const stepCountByChapter = new Map<string, number>();
            stepCountsResult.rows.forEach((row: { chapter_id: string; step_count: number }) => {
                stepCountByChapter.set(row.chapter_id, row.step_count);
            });

            const progressByChapter = new Map<string, any>();
            (progressRows || []).forEach(row => {
                progressByChapter.set(row.chapter_id, row);
            });

            return chapters.map(chapter => {
                const prog = progressByChapter.get(chapter.id);
                const totalSteps = stepCountByChapter.get(chapter.id) || 0;
                const completedSteps = Array.isArray(prog?.steps_completed)
                    ? prog.steps_completed.length
                    : 0;
                const status = prog?.status || (chapter.chapter_number === 1 ? 'UNLOCKED' : 'LOCKED');
                return {
                    ...chapter,
                    status,
                    total_steps: totalSteps,
                    completed_steps: completedSteps,
                    quiz_score: prog?.quiz_score ?? null,
                    tasks_completed: prog?.tasks_completed ?? 0,
                };
            });
        } catch (error) {
            logger.error('Get roadmap chapters error:', { userId, roadmapId, error });
            throw new Error('Failed to fetch roadmap chapters');
        }
    }

    static async updateQuizProgress(
        userId: string,
        chapterId: string,
        score: number,
        passed: boolean,
        totalQuestions?: number
    ) {
        try {
            const safeTotalQuestions = Number(totalQuestions) > 0 ? Number(totalQuestions) : 3;
            const percentScore = Math.round((Number(score || 0) / safeTotalQuestions) * 100);

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

            const canUnlock = Boolean(passed) && tasksCompleted >= 1;

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

    static async updateStepProgress(userId: string, chapterId: string, stepId: string) {
        try {
            const { data: existing, error: fetchError } = await supabase
                .from('user_chapter_progress')
                .select('id, steps_completed')
                .eq('user_id', userId)
                .eq('chapter_id', chapterId)
                .maybeSingle();

            if (fetchError && fetchError.code !== 'PGRST116') {
                throw fetchError;
            }

            const completed = new Set<string>(existing?.steps_completed || []);
            completed.add(stepId);

            const payload: any = {
                steps_completed: Array.from(completed),
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

            return {
                success: true,
                steps_completed: Array.from(completed),
            };
        } catch (error) {
            logger.error('Update step progress error:', { userId, chapterId, stepId, error });
            throw new Error('Failed to update step progress');
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

            const chapterRow = await pool.query(
                'SELECT * FROM public.chapters WHERE id = $1',
                [chapterId]
            );
            const chapter = chapterRow.rows[0];

            if (!chapter) {
                throw new Error('Chapter not found');
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

            const stepsResult = await pool.query(
                'SELECT type, content FROM public.steps WHERE chapter_id = $1 ORDER BY step_number ASC',
                [chapterId]
            );
            const celebration = ChaptersService.buildCelebrationMeta(chapter, stepsResult.rows);
            const xpReward = celebration.xp;

            try {
                const { data: userRow } = await supabase
                    .from('users')
                    .select('xp')
                    .eq('id', userId)
                    .maybeSingle();
                await supabase
                    .from('users')
                    .update({
                        xp: (userRow?.xp || 0) + xpReward,
                        updated_at: now,
                    })
                    .eq('id', userId);
            } catch (xpErr) {
                logger.warn('XP award on chapter unlock failed', xpErr);
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
                celebration: {
                    ...celebration,
                    xp_earned: xpReward,
                    streak_day: streakInfo?.streak ?? 1,
                },
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
