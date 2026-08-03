import { Request, Response } from 'express';
import { logApprenticeshipEvents } from './tracking.service';

const categoryByEventType: Record<string, string> = {
  page_view: 'navigation',
  time_on_page: 'navigation',
  tab_switch: 'navigation',
  project_started: 'verification',
  github_connect_initiated: 'github',
  github_connect_completed: 'github',
  github_connect_failed: 'github',
  repo_created: 'github',
  git_push_received: 'verification',
  verification_queued: 'verification',
  verification_started: 'verification',
  test_stage_passed: 'verification',
  test_stage_failed: 'verification',
  verification_passed: 'verification',
  verification_failed: 'verification',
  project_unlocked: 'verification',
  guide_step_expanded: 'guide',
  code_snippet_copied: 'guide',
  prompt_copied: 'guide',
  resource_link_clicked: 'guide',
  reference_solution_viewed: 'guide',
  ai_help_opened: 'ai',
  ai_help_query: 'ai',
  ai_help_response: 'ai',
  community_post_viewed: 'community',
  community_post_created: 'community',
  community_post_upvoted: 'community',
  community_reply_created: 'community',
  program_page_viewed: 'navigation',
  checkout_initiated: 'payment',
  coupon_applied: 'payment',
  coupon_rejected: 'payment',
  payment_initiated: 'payment',
  payment_completed: 'payment',
  payment_failed: 'payment',
  enrollment_completed: 'payment',
  certificate_viewed: 'certificate',
  certificate_downloaded: 'certificate',
  certificate_linkedin_shared: 'certificate',
};

export class TrackingController {
  static async ingest(req: Request, res: Response) {
    const events = Array.isArray(req.body?.events) ? req.body.events : [];

    if (events.length === 0 || events.length > 50) {
      return res.status(400).end();
    }

    await logApprenticeshipEvents(
      events.map((event: any) => ({
        userId: (req as any).user?.id || null,
        sessionId: event.session_id,
        eventType: event.event_type,
        eventCategory: event.event_category || categoryByEventType[event.event_type] || 'general',
        eventData: event.event_data || {},
        pageUrl: event.page_url || null,
        referrerUrl: event.referrer_url || (typeof req.headers.referer === 'string' ? req.headers.referer : null),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        enrollmentId: event.enrollment_id || null,
        projectId: event.project_id || null,
        submissionId: event.submission_id || null,
        createdAt: event.timestamp,
      }))
    );

    res.status(202).end();
  }
}
