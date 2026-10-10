import { Request, Response } from 'express';
import { pool } from '../../../config/database';
import logger from '../../../config/logger';

/**
 * Custom (influencer) referral codes, stored in public.referral_codes with is_custom = true.
 * A learner has at most one custom code (unique (user_id, is_custom)); "primary" means it is active.
 * The admin page's field names are kept: reward_amount = custom_commission_fixed (paise),
 * commission_percentage = custom_commission_pct, is_primary = is_active.
 */
const SELECT = `
  select rc.id, rc.user_id, rc.code, rc.custom_label as label,
         rc.custom_commission_fixed as reward_amount, rc.custom_commission_pct as commission_percentage,
         rc.is_active as is_primary, rc.total_referrals, rc.total_earnings, rc.created_at,
         json_build_object('full_name', u.full_name, 'email', u.email) as users
    from public.referral_codes rc
    left join public.users u on u.id = rc.user_id`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readBody(body: any) {
    const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return { error: 'Code must be 3–32 letters, digits, - or _' };
    const reward = body.reward_amount === undefined || body.reward_amount === null || body.reward_amount === '' ? null : Number(body.reward_amount);
    if (reward !== null && (!Number.isInteger(reward) || reward < 0)) return { error: 'Reward must be a whole number of paise' };
    const pct = body.commission_percentage === undefined || body.commission_percentage === null || body.commission_percentage === '' ? null : Number(body.commission_percentage);
    if (pct !== null && (!Number.isFinite(pct) || pct < 0 || pct > 100)) return { error: 'Commission must be between 0 and 100%' };
    return { code, reward, pct, active: body.is_primary !== false, label: typeof body.label === 'string' ? body.label.trim().slice(0, 80) || null : null };
}

function dbError(res: Response, e: any, what: string) {
    if (e?.code === '23505') return res.status(409).json({ error: 'That code is already taken' });
    if (e?.code === '23503') return res.status(400).json({ error: 'Unknown user' });
    logger.error(`${what} failed`, { message: e?.message, code: e?.code });
    return res.status(500).json({ error: `${what} failed` });
}

export const getCustomReferrals = async (_req: Request, res: Response) => {
    try {
        const { rows } = await pool.query(`${SELECT} where rc.is_custom order by rc.created_at desc`);
        res.json({ data: rows });
    } catch (e) {
        dbError(res, e, 'Loading custom referral codes');
    }
};

/** Creates the learner's custom code, or replaces it if they already have one. */
export const createCustomReferral = async (req: Request, res: Response) => {
    const userId = req.body?.user_id;
    if (typeof userId !== 'string' || !UUID.test(userId)) return res.status(400).json({ error: 'user_id must be a user id' });
    const b = readBody(req.body);
    if ('error' in b) return res.status(400).json({ error: b.error });
    try {
        const adminId = (req as any).user?.id ?? null;
        const { rows } = await pool.query(
            `insert into public.referral_codes (user_id, code, is_custom, custom_label, custom_commission_pct, custom_commission_fixed, is_active, created_by_admin)
             values ($1, $2, true, $3, $4, $5, $6, $7)
             on conflict (user_id, is_custom) do update set code = excluded.code, custom_label = excluded.custom_label,
               custom_commission_pct = excluded.custom_commission_pct, custom_commission_fixed = excluded.custom_commission_fixed,
               is_active = excluded.is_active, updated_at = now()
             returning id`,
            [userId, b.code, b.label, b.pct, b.reward, b.active, adminId]);
        const { rows: out } = await pool.query(`${SELECT} where rc.id = $1`, [rows[0].id]);
        res.status(201).json({ success: true, data: out[0] });
    } catch (e) {
        dbError(res, e, 'Creating the referral code');
    }
};

export const updateCustomReferral = async (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!UUID.test(id)) return res.status(404).json({ error: 'Code not found' });
    const b = readBody(req.body);
    if ('error' in b) return res.status(400).json({ error: b.error });
    try {
        const { rowCount } = await pool.query(
            `update public.referral_codes set code = $2, custom_commission_fixed = $3, custom_commission_pct = $4, is_active = $5,
                    custom_label = coalesce($6, custom_label), updated_at = now()
              where id = $1 and is_custom`,
            [id, b.code, b.reward, b.pct, b.active, b.label]);
        if (!rowCount) return res.status(404).json({ error: 'Code not found' });
        const { rows } = await pool.query(`${SELECT} where rc.id = $1`, [id]);
        res.json({ success: true, data: rows[0] });
    } catch (e) {
        dbError(res, e, 'Updating the referral code');
    }
};
