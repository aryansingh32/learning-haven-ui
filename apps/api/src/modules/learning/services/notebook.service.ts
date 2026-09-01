import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';
import { supabase, pool } from '../../../config/database';
import logger from '../../../config/logger';

export class NotebookService {
    static async getChapterNotes(userId: string, chapterId: string) {
        const { data, error } = await supabase
            .from('chapter_notes')
            .select('content, updated_at')
            .eq('user_id', userId)
            .eq('chapter_id', chapterId)
            .maybeSingle();

        if (error) {
            logger.error('Get chapter notes error:', { userId, chapterId, error });
            throw new Error('Failed to fetch chapter notes');
        }

        return { content: data?.content || '', updated_at: data?.updated_at || null };
    }

    static async saveChapterNotes(userId: string, chapterId: string, content: string) {
        const chapterResult = await pool.query(
            'SELECT course_id FROM public.chapters WHERE id = $1',
            [chapterId]
        );
        const courseId = chapterResult.rows[0]?.course_id;
        if (!courseId) {
            throw new Error('Chapter not found');
        }

        const { data, error } = await supabase
            .from('chapter_notes')
            .upsert(
                {
                    user_id: userId,
                    chapter_id: chapterId,
                    course_id: courseId,
                    content,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id,chapter_id' }
            )
            .select('content, updated_at')
            .single();

        if (error) {
            logger.error('Save chapter notes error:', { userId, chapterId, error });
            throw new Error('Failed to save chapter notes');
        }

        return data;
    }

    /**
     * Aggregates everything a learner has produced in a course — per-chapter notes,
     * quiz scores, and submitted task responses — into one notebook, page per chapter.
     */
    static async getCourseNotebook(userId: string, courseId: string) {
        const courseResult = await pool.query(
            'SELECT id, title, slug FROM public.courses WHERE id = $1',
            [courseId]
        );
        const course = courseResult.rows[0];
        if (!course) {
            throw new Error('Course not found');
        }

        const chaptersResult = await pool.query(
            'SELECT id, chapter_number, title, topic_tag FROM public.chapters WHERE course_id = $1 ORDER BY chapter_number ASC',
            [courseId]
        );
        const chapters = chaptersResult.rows;
        const chapterIds = chapters.map((c) => c.id);

        const [progressResult, notesResult, userResult] = await Promise.all([
            chapterIds.length
                ? pool.query(
                      'SELECT * FROM public.user_chapter_progress WHERE user_id = $1 AND chapter_id = ANY($2)',
                      [userId, chapterIds]
                  )
                : Promise.resolve({ rows: [] }),
            chapterIds.length
                ? pool.query(
                      'SELECT chapter_id, content, updated_at FROM public.chapter_notes WHERE user_id = $1 AND chapter_id = ANY($2)',
                      [userId, chapterIds]
                  )
                : Promise.resolve({ rows: [] }),
            supabase.from('users').select('full_name').eq('id', userId).maybeSingle(),
        ]);

        const progressByChapter = new Map<string, any>();
        progressResult.rows.forEach((row: any) => progressByChapter.set(row.chapter_id, row));

        const notesByChapter = new Map<string, any>();
        notesResult.rows.forEach((row: any) => notesByChapter.set(row.chapter_id, row));

        const entries = chapters.map((chapter) => {
            const progress = progressByChapter.get(chapter.id);
            const notes = notesByChapter.get(chapter.id);

            return {
                chapter_id: chapter.id,
                chapter_number: chapter.chapter_number,
                title: chapter.title,
                topic_tag: chapter.topic_tag || null,
                status: progress?.status || 'LOCKED',
                completed_at: progress?.completed_at || null,
                notes: notes?.content || '',
                notes_updated_at: notes?.updated_at || null,
                quiz_score: progress?.quiz_score ?? null,
                quiz_attempts: progress?.quiz_attempts ?? 0,
                task_response: progress?.task_response || null,
                task_submitted_at: progress?.task_submitted_at || null,
            };
        });

        const completedCount = entries.filter((e) => e.status === 'COMPLETED').length;
        const hasContent = entries.some((e) => e.notes || e.task_response || e.quiz_score);

        return {
            course: { id: course.id, title: course.title, slug: course.slug },
            learner_name: (userResult.data as any)?.full_name || 'Learner',
            generated_at: new Date().toISOString(),
            total_chapters: chapters.length,
            completed_chapters: completedCount,
            has_content: hasContent,
            entries,
        };
    }

    /**
     * Renders the notebook as a branded, watermarked PDF and uploads it to
     * the shared 'certificates' storage bucket under a notebooks/ prefix.
     * Gated behind the notebook_pdf_export entitlement at the route level.
     */
    static async exportCourseNotebookPdf(userId: string, courseId: string) {
        const notebook = await NotebookService.getCourseNotebook(userId, courseId);
        const pdfBytes = await NotebookService.renderNotebookPdf(notebook);

        const fileName = `notebooks/${userId}/${courseId}-${Date.now()}.pdf`;
        const { error: uploadError } = await supabase.storage
            .from('certificates')
            .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true });

        if (uploadError) {
            logger.error('Notebook PDF upload failed:', uploadError);
            throw new Error('Failed to generate notebook PDF');
        }

        const { data: urlData } = supabase.storage.from('certificates').getPublicUrl(fileName);

        return { url: urlData.publicUrl, generated_at: notebook.generated_at };
    }

    private static async renderNotebookPdf(notebook: Awaited<ReturnType<typeof NotebookService.getCourseNotebook>>) {
        const doc = await PDFDocument.create();
        const helvetica = await doc.embedFont(StandardFonts.Helvetica);
        const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);

        const pageSize: [number, number] = [595, 842]; // A4 portrait
        const margin = 56;

        const drawWatermark = (page: PDFPage) => {
            const { width } = page.getSize();
            const footer = 'Learning Haven — learningHaven.app';
            const footerWidth = helvetica.widthOfTextAtSize(footer, 9);
            page.drawText(footer, {
                x: (width - footerWidth) / 2,
                y: 28,
                size: 9,
                font: helvetica,
                color: rgb(0.6, 0.6, 0.6),
            });
        };

        // Cover page
        const cover = doc.addPage(pageSize);
        const { width, height } = cover.getSize();
        cover.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.98, 0.97, 0.95) });
        cover.drawRectangle({
            x: 24, y: 24, width: width - 48, height: height - 48,
            borderColor: rgb(0.85, 0.65, 0.13), borderWidth: 2,
        });
        const brand = 'LEARNING HAVEN';
        cover.drawText(brand, {
            x: (width - helveticaBold.widthOfTextAtSize(brand, 16)) / 2,
            y: height - 120, size: 16, font: helveticaBold, color: rgb(0.85, 0.65, 0.13),
        });
        const title = 'My Notebook';
        cover.drawText(title, {
            x: (width - helveticaBold.widthOfTextAtSize(title, 30)) / 2,
            y: height - 200, size: 30, font: helveticaBold, color: rgb(0.15, 0.15, 0.15),
        });
        const courseTitle = notebook.course.title;
        cover.drawText(courseTitle, {
            x: (width - helvetica.widthOfTextAtSize(courseTitle, 16)) / 2,
            y: height - 240, size: 16, font: helvetica, color: rgb(0.35, 0.35, 0.35),
        });
        const learnerLine = `${notebook.learner_name} • ${notebook.completed_chapters}/${notebook.total_chapters} chapters completed`;
        cover.drawText(learnerLine, {
            x: (width - helvetica.widthOfTextAtSize(learnerLine, 12)) / 2,
            y: height - 270, size: 12, font: helvetica, color: rgb(0.5, 0.5, 0.5),
        });
        const dateLine = `Generated ${new Date(notebook.generated_at).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'long', year: 'numeric',
        })}`;
        cover.drawText(dateLine, {
            x: (width - helvetica.widthOfTextAtSize(dateLine, 11)) / 2,
            y: height - 292, size: 11, font: helvetica, color: rgb(0.6, 0.6, 0.6),
        });
        drawWatermark(cover);

        // One page per chapter that has any learner content
        const contentEntries = notebook.entries.filter((e) => e.notes || e.task_response || e.quiz_score);
        const pagesToRender = contentEntries.length ? contentEntries : notebook.entries;

        for (const entry of pagesToRender) {
            let page = doc.addPage(pageSize);
            let cursorY = height - margin;
            const maxWidth = width - margin * 2;

            const wrapText = (text: string, font: PDFFont, size: number): string[] => {
                const words = text.replace(/\r/g, '').split(/\s+/);
                const lines: string[] = [];
                let current = '';
                for (const word of words) {
                    const candidate = current ? `${current} ${word}` : word;
                    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
                        lines.push(current);
                        current = word;
                    } else {
                        current = candidate;
                    }
                }
                if (current) lines.push(current);
                return lines;
            };

            const ensureSpace = (needed: number) => {
                if (cursorY - needed < margin + 20) {
                    drawWatermark(page);
                    page = doc.addPage(pageSize);
                    cursorY = height - margin;
                }
            };

            const heading = `Chapter ${entry.chapter_number}: ${entry.title}`;
            for (const line of wrapText(heading, helveticaBold, 18)) {
                ensureSpace(24);
                page.drawText(line, { x: margin, y: cursorY, size: 18, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
                cursorY -= 24;
            }
            cursorY -= 8;

            if (entry.quiz_score !== null) {
                ensureSpace(18);
                page.drawText(`Quiz score: ${entry.quiz_score}% (${entry.quiz_attempts} attempt${entry.quiz_attempts === 1 ? '' : 's'})`, {
                    x: margin, y: cursorY, size: 11, font: helvetica, color: rgb(0.85, 0.5, 0.1),
                });
                cursorY -= 22;
            }

            if (entry.notes) {
                ensureSpace(18);
                page.drawText('My Notes', { x: margin, y: cursorY, size: 13, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });
                cursorY -= 18;
                for (const rawLine of entry.notes.split('\n')) {
                    const lines = rawLine.trim() ? wrapText(rawLine, helvetica, 11) : [''];
                    for (const line of lines) {
                        ensureSpace(16);
                        page.drawText(line, { x: margin, y: cursorY, size: 11, font: helvetica, color: rgb(0.25, 0.25, 0.25) });
                        cursorY -= 16;
                    }
                }
                cursorY -= 10;
            }

            if (entry.task_response) {
                ensureSpace(18);
                page.drawText('Task Response', { x: margin, y: cursorY, size: 13, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });
                cursorY -= 18;
                for (const rawLine of entry.task_response.split('\n')) {
                    const lines = rawLine.trim() ? wrapText(rawLine, helvetica, 11) : [''];
                    for (const line of lines) {
                        ensureSpace(16);
                        page.drawText(line, { x: margin, y: cursorY, size: 11, font: helvetica, color: rgb(0.25, 0.25, 0.25) });
                        cursorY -= 16;
                    }
                }
            }

            if (!entry.notes && !entry.task_response && entry.quiz_score === null) {
                page.drawText('No notes yet — write some from the chapter page!', {
                    x: margin, y: cursorY, size: 11, font: helvetica, color: rgb(0.6, 0.6, 0.6),
                });
            }

            drawWatermark(page);
        }

        return doc.save();
    }
}
