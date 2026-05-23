import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { logApprenticeshipEvents } from '../modules/apprenticeship/tracking.service';

const categoryByEventType: Record<string, string> = {
  page_view: 'navigation',
  time_on_page: 'navigation',
  project_started: 'verification',
  repo_created: 'github',
  github_connect_initiated: 'github',
  github_connect_completed: 'github',
  github_connect_failed: 'github',
  git_push_received: 'verification',
  verification_queued: 'verification',
  verification_started: 'verification',
  verification_passed: 'verification',
  verification_failed: 'verification',
  test_stage_passed: 'verification',
  test_stage_failed: 'verification',
  certificate_issued: 'certificate',
  certificate_viewed: 'certificate',
  ai_help_query: 'ai',
  ai_help_response: 'ai',
  community_post_created: 'community',
  community_post_upvoted: 'community',
  coupon_applied: 'payment',
  payment_completed: 'payment',
  payment_failed: 'payment',
};

const getSessionId = (req: Request) =>
  String(req.headers['x-session-id'] || crypto.randomUUID());

export const apprenticeshipTracker = (
  eventType: string,
  category?: string,
  extractData?: (req: Request, body: unknown) => Record<string, unknown>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = ((body: unknown) => {
      const result = originalJson(body);

      setImmediate(async () => {
        try {
          await logApprenticeshipEvents([
            {
              userId: (req as any).user?.id || null,
              sessionId: getSessionId(req),
              eventType,
              eventCategory: category || categoryByEventType[eventType] || 'general',
              eventData: {
                ...(extractData ? extractData(req, body) : {}),
                responseStatus: res.statusCode,
                success: Boolean((body as any)?.success),
              },
              pageUrl: typeof req.headers.referer === 'string' ? req.headers.referer : req.originalUrl,
              referrerUrl: typeof req.headers.referer === 'string' ? req.headers.referer : null,
              ipAddress: req.ip || null,
              userAgent: req.headers['user-agent'] || null,
              enrollmentId: (req.params as any).enrollmentId || req.body?.enrollmentId || null,
              projectId: (req.params as any).projectId || req.body?.projectId || null,
              submissionId: (req.params as any).submissionId || null,
            },
          ]);
        } catch {
          // tracking must never break responses
        }
      });

      return result;
    }) as any;

    next();
  };
};
