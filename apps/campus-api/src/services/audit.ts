import { asSystem } from '../db';

/**
 * Record an export in the college's activity log. Data changes are logged by
 * database triggers; exports don't change rows, so the API notes them here.
 */
export async function logExport(orgId: string, actorId: string, what: string, summary: string) {
  await asSystem((db) => db.query(
    `insert into campus.audit_log (org_id, actor_id, action, entity, summary) values ($1, $2, 'export', $3, $4)`,
    [orgId, actorId, what, summary.slice(0, 300)]));
}
