import { asUser, Db } from './db';
import { forbidden } from './errors';

export type Permission =
  | 'org.manage' | 'org.billing' | 'members.manage' | 'members.view' | 'batches.manage'
  | 'content.create' | 'assessments.create' | 'assessments.grade' | 'assessments.invigilate'
  | 'reports.view' | 'reports.export' | 'records.view' | 'placements.manage';

/** Same rule the RLS policies use, asked up front so the user gets a clear 403. */
export async function hasPermission(db: Db, orgId: string, permission: Permission): Promise<boolean> {
  const { rows } = await db.query<{ ok: boolean }>(`select campus.has_org_permission($1, $2) as ok`, [orgId, permission]);
  return rows[0]?.ok === true;
}

export async function requirePermission(userId: string, orgId: string, permission: Permission): Promise<void> {
  const ok = await asUser(userId, (db) => hasPermission(db, orgId, permission));
  if (!ok) throw forbidden();
}

/** At least one of the permissions (e.g. invigilators or report viewers may watch a live test). */
export async function requireAnyPermission(userId: string, orgId: string, permissions: Permission[]): Promise<void> {
  const ok = await asUser(userId, async (db) => {
    for (const p of permissions) if (await hasPermission(db, orgId, p)) return true;
    return false;
  });
  if (!ok) throw forbidden();
}
