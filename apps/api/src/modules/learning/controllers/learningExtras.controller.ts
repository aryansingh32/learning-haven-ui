import { Request, Response } from 'express';
import logger from '../../../config/logger';
import {
    DiscussionsService, DiscussionsUnavailableError, REPORT_REASONS, isUuid, parsePostBody, type ReportReason,
} from '../services/discussions.service';
import {
    HighlightsService, HighlightsUnavailableError, HIGHLIGHT_COLORS, parseHighlightInput, type HighlightColor,
} from '../services/highlights.service';

const userIdOf = (req: Request) => (req as unknown as { user?: { id?: string } }).user?.id;

function handleError(res: Response, err: unknown, what: string) {
    if (err instanceof DiscussionsUnavailableError || err instanceof HighlightsUnavailableError) {
        return res.status(503).json({ error: err.message });
    }
    logger.error(`${what} failed`, { error: (err as Error).message });
    return res.status(500).json({ error: 'Internal Server Error' });
}

type Result<T> = { ok: true; value: T } | { ok: false; status: number; error: string };
function send<T>(res: Response, r: Result<T>) {
    if (r.ok === true) return res.json(r.value);
    const failed = r as { status: number; error: string };
    return res.status(failed.status).json({ error: failed.error });
}

/** Chapter highlights (own) and chapter discussions. */
export class LearningExtrasController {
    // ── Highlights ────────────────────────────────────────────────────────
    static async listHighlights(req: Request, res: Response) {
        const userId = userIdOf(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        try {
            return res.json(await HighlightsService.listForChapter(userId, String(req.params.chapterId)));
        } catch (err) {
            return handleError(res, err, 'List highlights');
        }
    }

    static async createHighlight(req: Request, res: Response) {
        const userId = userIdOf(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const input = parseHighlightInput(req.body);
        if (typeof input === 'string') return res.status(400).json({ error: input });
        try {
            const created = await HighlightsService.create(userId, String(req.params.chapterId), input);
            if (created === null) return res.status(404).json({ error: 'Chapter not found' });
            if (created === 'limit') return res.status(409).json({ error: 'You have reached the highlight limit for this chapter' });
            if (created === 'bad_step') return res.status(400).json({ error: 'That step is not part of this chapter' });
            return res.status(201).json({ highlight: created });
        } catch (err) {
            return handleError(res, err, 'Create highlight');
        }
    }

    static async updateHighlight(req: Request, res: Response) {
        const userId = userIdOf(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const color = req.body?.color;
        if (!HIGHLIGHT_COLORS.includes(color)) return res.status(400).json({ error: 'Unknown highlight colour' });
        try {
            const updated = await HighlightsService.recolor(userId, String(req.params.id), color as HighlightColor);
            return updated ? res.json({ highlight: updated }) : res.status(404).json({ error: 'Highlight not found' });
        } catch (err) {
            return handleError(res, err, 'Update highlight');
        }
    }

    static async deleteHighlight(req: Request, res: Response) {
        const userId = userIdOf(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        try {
            return (await HighlightsService.remove(userId, String(req.params.id)))
                ? res.json({ success: true })
                : res.status(404).json({ error: 'Highlight not found' });
        } catch (err) {
            return handleError(res, err, 'Delete highlight');
        }
    }

    // ── Discussions ───────────────────────────────────────────────────────
    static async listPosts(req: Request, res: Response) {
        const userId = userIdOf(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        try {
            return send(res, await DiscussionsService.list(userId, String(req.params.chapterId)));
        } catch (err) {
            return handleError(res, err, 'List discussion');
        }
    }

    static async createPost(req: Request, res: Response) {
        const userId = userIdOf(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const parsed = parsePostBody(req.body?.body);
        if ('error' in parsed) return res.status(400).json({ error: parsed.error });
        const parentId = req.body?.parent_id ?? null;
        if (parentId !== null && !isUuid(parentId)) return res.status(400).json({ error: 'Invalid parent_id' });
        try {
            const r = await DiscussionsService.create(userId, String(req.params.chapterId), parsed.body, parentId);
            return r.ok === true ? res.status(201).json(r.value) : send(res, r);
        } catch (err) {
            return handleError(res, err, 'Create post');
        }
    }

    static async editPost(req: Request, res: Response) {
        const userId = userIdOf(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Post not found' });
        const parsed = parsePostBody(req.body?.body);
        if ('error' in parsed) return res.status(400).json({ error: parsed.error });
        try {
            return send(res, await DiscussionsService.edit(userId, String(req.params.id), parsed.body));
        } catch (err) {
            return handleError(res, err, 'Edit post');
        }
    }

    static async deletePost(req: Request, res: Response) {
        const userId = userIdOf(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Post not found' });
        try {
            return send(res, await DiscussionsService.remove(userId, String(req.params.id)));
        } catch (err) {
            return handleError(res, err, 'Delete post');
        }
    }

    static async reportPost(req: Request, res: Response) {
        const userId = userIdOf(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Post not found' });
        const reason = req.body?.reason;
        if (!REPORT_REASONS.includes(reason)) return res.status(400).json({ error: `reason must be one of: ${REPORT_REASONS.join(', ')}` });
        const details = typeof req.body?.details === 'string' && req.body.details.trim() ? req.body.details.trim().slice(0, 500) : null;
        try {
            return send(res, await DiscussionsService.report(userId, String(req.params.id), reason as ReportReason, details));
        } catch (err) {
            return handleError(res, err, 'Report post');
        }
    }

    static async moderatePost(req: Request, res: Response) {
        const userId = userIdOf(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Post not found' });
        if (typeof req.body?.hidden !== 'boolean') return res.status(400).json({ error: 'hidden must be true or false' });
        const reason = typeof req.body?.reason === 'string' && req.body.reason.trim() ? req.body.reason.trim().slice(0, 300) : null;
        try {
            return send(res, await DiscussionsService.moderate(userId, String(req.params.id), req.body.hidden, reason));
        } catch (err) {
            return handleError(res, err, 'Moderate post');
        }
    }
}
