import { pool } from '../../../config/database';
import { env } from '../../../config/env';
import logger from '../../../config/logger';

/** GST tax invoices: issued once per paid payment by public.issue_invoice (numbering and tax split live in the database). */

export interface Seller { name: string; gstin: string; state_code: string; address: string | null }

export class InvoiceError extends Error {
    constructor(public status: number, message: string) { super(message); }
}

/** The seller printed on invoices, or null while the business hasn't set its GST details. */
export function sellerFromEnv(e: Partial<typeof env> = env): Seller | null {
    if (!e.SELLER_LEGAL_NAME || !e.SELLER_GSTIN) return null;
    return { name: e.SELLER_LEGAL_NAME, gstin: e.SELLER_GSTIN, state_code: e.SELLER_GSTIN.slice(0, 2), address: e.SELLER_ADDRESS ?? null };
}

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export interface BillingProfileInput { legal_name?: unknown; gstin?: unknown; state_code?: unknown; address?: unknown }

/** Clean and check billing details; returns the row to save or an error message. */
export function cleanBillingProfile(b: BillingProfileInput): { ok: true; value: { legal_name: string | null; gstin: string | null; state_code: string | null; address: string | null } } | { ok: false; error: string } {
    const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
    const legal_name = text(b.legal_name, 120);
    const gstin = typeof b.gstin === 'string' && b.gstin.trim() ? b.gstin.trim().toUpperCase() : null;
    let state_code = typeof b.state_code === 'string' && b.state_code.trim() ? b.state_code.trim() : null;
    const address = text(b.address, 300);
    if (gstin && !GSTIN.test(gstin)) return { ok: false, error: 'That GSTIN doesn’t look right — it has 15 characters, like 29ABCDE1234F1Z5' };
    if (state_code && !/^[0-9]{2}$/.test(state_code)) return { ok: false, error: 'Pick your state' };
    if (gstin && state_code && gstin.slice(0, 2) !== state_code) return { ok: false, error: 'Your GSTIN is registered in a different state from the one picked' };
    if (gstin && !state_code) state_code = gstin.slice(0, 2);
    return { ok: true, value: { legal_name, gstin, state_code, address } };
}

export class InvoiceService {
    /** After a payment is captured: issue its invoice if the seller is set up. Never fails the payment. */
    static async issueQuietly(paymentId: string) {
        const seller = sellerFromEnv();
        if (!seller) return;
        try {
            await pool.query('select invoice_no from public.issue_invoice($1, $2)', [paymentId, seller]);
        } catch (error: any) {
            // e.g. a free order, or the invoices migration not applied yet — the invoice can still be issued on first view.
            logger.warn('Invoice not issued after capture', { paymentId, error: error?.message });
        }
    }

    /** The learner's invoice for one of their payments, issuing it the first time it is asked for. */
    static async getForUser(userId: string, paymentId: string) {
        const pay = await pool.query('select status, final_amount from public.payments where id = $1 and user_id = $2', [paymentId, userId]);
        if (pay.rows.length === 0) throw new InvoiceError(404, 'Payment not found');
        const existing = await pool.query('select * from public.invoices where payment_id = $1', [paymentId]);
        if (existing.rows[0]) return existing.rows[0];
        const { status, final_amount } = pay.rows[0];
        if (status !== 'captured') throw new InvoiceError(409, 'An invoice is issued once the payment goes through');
        if (Number(final_amount) <= 0) throw new InvoiceError(409, 'Free orders don’t need a tax invoice');
        const seller = sellerFromEnv();
        if (!seller) throw new InvoiceError(503, 'Invoices aren’t available yet — we’ll email yours as soon as they are');
        const issued = await pool.query('select * from public.issue_invoice($1, $2)', [paymentId, seller]);
        return issued.rows[0];
    }

    static async getProfile(userId: string) {
        const r = await pool.query('select legal_name, gstin, state_code, address from public.billing_profiles where user_id = $1', [userId]);
        return r.rows[0] ?? { legal_name: null, gstin: null, state_code: null, address: null };
    }

    static async saveProfile(userId: string, value: { legal_name: string | null; gstin: string | null; state_code: string | null; address: string | null }) {
        const r = await pool.query(
            `insert into public.billing_profiles (user_id, legal_name, gstin, state_code, address) values ($1, $2, $3, $4, $5)
             on conflict (user_id) do update set legal_name = excluded.legal_name, gstin = excluded.gstin, state_code = excluded.state_code,
                                                 address = excluded.address, updated_at = now()
             returning legal_name, gstin, state_code, address`,
            [userId, value.legal_name, value.gstin, value.state_code, value.address],
        );
        return r.rows[0];
    }
}
