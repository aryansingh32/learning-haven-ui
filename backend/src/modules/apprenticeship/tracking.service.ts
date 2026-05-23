import { pool } from '../../config/database';

export interface ApprenticeshipEventInsert {
  userId: string | null;
  sessionId: string;
  eventType: string;
  eventCategory: string;
  eventData: unknown;
  pageUrl: string | null;
  referrerUrl?: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  enrollmentId: string | null;
  projectId: string | null;
  submissionId: string | null;
  createdAt?: string;
}

export async function logApprenticeshipEvents(events: ApprenticeshipEventInsert[]) {
  if (events.length === 0) return;

  const userIds = events.map((event) => event.userId);
  const sessionIds = events.map((event) => event.sessionId);
  const eventTypes = events.map((event) => event.eventType);
  const eventCategories = events.map((event) => event.eventCategory);
  const eventDatas = events.map((event) => JSON.stringify(event.eventData ?? {}));
  const pageUrls = events.map((event) => event.pageUrl);
  const referrerUrls = events.map((event) => event.referrerUrl || null);
  const ipAddresses = events.map((event) => event.ipAddress);
  const userAgents = events.map((event) => event.userAgent);
  const enrollmentIds = events.map((event) => event.enrollmentId);
  const projectIds = events.map((event) => event.projectId);
  const submissionIds = events.map((event) => event.submissionId);
  const createdAts = events.map((event) => event.createdAt || new Date().toISOString());

  await pool.query(
    `insert into apprenticeship_events
      (user_id, session_id, event_type, event_category, event_data, page_url, referrer_url, ip_address, user_agent, enrollment_id, project_id, submission_id, created_at)
     select
      user_id,
      session_id,
      event_type,
      event_category,
      event_data::jsonb,
      page_url,
      referrer_url,
      ip_address,
      user_agent,
      enrollment_id,
      project_id,
      submission_id,
      created_at
     from unnest(
      $1::uuid[],
      $2::text[],
      $3::text[],
      $4::text[],
      $5::text[],
      $6::text[],
      $7::text[],
      $8::inet[],
      $9::text[],
      $10::uuid[],
      $11::uuid[],
      $12::uuid[],
      $13::timestamptz[]
     ) as payload(
      user_id,
      session_id,
      event_type,
      event_category,
      event_data,
      page_url,
      referrer_url,
      ip_address,
      user_agent,
      enrollment_id,
      project_id,
      submission_id,
      created_at
     )`,
    [userIds, sessionIds, eventTypes, eventCategories, eventDatas, pageUrls, referrerUrls, ipAddresses, userAgents, enrollmentIds, projectIds, submissionIds, createdAts]
  );
}
