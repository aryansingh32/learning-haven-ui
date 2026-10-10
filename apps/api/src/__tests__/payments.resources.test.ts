/**
 * Buying courses and bundles: activation gives entitlements (never a subscription), the
 * webhook path does the same, refunds take back only what that payment bought, and an
 * order can only be confirmed by the person who placed it.
 */
jest.mock('../config/database', () => ({ pool: { query: jest.fn(), connect: jest.fn() }, supabase: { auth: { getUser: jest.fn() } } }));

import { pool } from '../config/database';
import { PaymentsV2Service } from '../modules/billing/services/payments.v2.service';
import { TEST_USER } from './setup';

const mockQuery = pool.query as jest.Mock;
const clientQuery = jest.fn();
const COURSES = ['c0000000-0000-4000-a000-000000000001', 'c0000000-0000-4000-a000-000000000002', 'c0000000-0000-4000-a000-000000000003'];
const BUNDLE = 'b0000000-0000-4000-a000-0000000000b1';

let payment: Record<string, unknown>;
const sqlOf = (m: jest.Mock) => m.mock.calls.map((c) => String(c[0]).replace(/\s+/g, ' ').toLowerCase());
const entitlementInserts = () => clientQuery.mock.calls.filter((c) => /insert into public\.user_entitlements/i.test(String(c[0])));

beforeEach(() => {
    jest.clearAllMocks();
    (pool.connect as jest.Mock).mockResolvedValue({ query: clientQuery, release: jest.fn() });
    clientQuery.mockImplementation((sql: string) => {
        const s = sql.toLowerCase();
        if (s.includes('from public.payments') && s.includes('for update')) return Promise.resolve({ rows: payment ? [payment] : [] });
        if (s.includes('from public.payments where razorpay_payment_id')) return Promise.resolve({ rows: payment ? [payment] : [] });
        if (s.includes('from public.plans')) return Promise.resolve({ rows: [{ slug: 'pro', name: 'Pro' }] });
        if (s.includes('insert into public.subscriptions')) return Promise.resolve({ rows: [{ id: 'sub-1' }] });
        return Promise.resolve({ rows: [], rowCount: 1 });
    });
});

describe('course and bundle purchases', () => {
    it('activates a course purchase without touching plans', async () => {
        payment = { id: 'pay-c', user_id: TEST_USER.id, plan_id: null, status: 'created', final_amount: 49900, billing_cycle: 'one_time',
            description: 'DSA (one-time purchase)', metadata: { purchase_kind: 'course', resource_type: 'course', resource_id: COURSES[0] } };
        const res = await PaymentsV2Service.verifyAndActivate(TEST_USER.id, 'order_c', 'pay_c', 'sig');
        expect(res).toMatchObject({ success: true, subscriptionId: null, plan: null, courseIds: [COURSES[0]] });
        expect(entitlementInserts()).toHaveLength(1);
        expect(entitlementInserts()[0][1]).toEqual(expect.arrayContaining([TEST_USER.id, 'course_access', 'course', COURSES[0], 'DSA (one-time purchase)', 'pay-c']));
        expect(sqlOf(clientQuery).some((s) => s.includes('insert into public.subscriptions') || s.includes('update public.users set current_plan'))).toBe(false);
    });

    it('gives every course of a bundle', async () => {
        payment = { id: 'pay-b', user_id: TEST_USER.id, plan_id: null, status: 'created', final_amount: 99900, billing_cycle: 'one_time',
            description: 'Placement pack (bundle, one-time purchase)', metadata: { purchase_kind: 'bundle', resource_type: 'bundle', resource_id: BUNDLE, course_ids: COURSES } };
        const res = await PaymentsV2Service.verifyAndActivate(TEST_USER.id, 'order_b', 'pay_b', 'sig');
        expect(res.courseIds).toEqual(COURSES);
        expect(entitlementInserts().map((c) => c[1][3])).toEqual(COURSES);
        // A course owned for longer keeps its own record (and its own refund).
        expect(String(entitlementInserts()[0][0])).toMatch(/where public\.user_entitlements\.bool_value = false/i);
        expect(entitlementInserts()[0][1][8]).toMatchObject({ bundle_id: BUNDLE });
    });

    it('still activates a plan as a subscription', async () => {
        payment = { id: 'pay-p', user_id: TEST_USER.id, plan_id: 'plan-1', status: 'created', final_amount: 9900, billing_cycle: 'monthly', metadata: {} };
        const res = await PaymentsV2Service.verifyAndActivate(TEST_USER.id, 'order_p', 'pay_p', 'sig');
        expect(res).toMatchObject({ subscriptionId: 'sub-1', plan: { slug: 'pro' } });
        expect(entitlementInserts()).toHaveLength(0);
    });

    it('refuses to confirm someone else\'s order', async () => {
        payment = { id: 'pay-x', user_id: 'someone-else', plan_id: null, status: 'created', final_amount: 49900, billing_cycle: 'one_time',
            metadata: { resource_type: 'course', resource_id: COURSES[0] } };
        await expect(PaymentsV2Service.verifyAndActivate(TEST_USER.id, 'order_x', 'pay_x', 'sig')).rejects.toThrow('Payment not found');
        expect(entitlementInserts()).toHaveLength(0);
        expect(clientQuery).toHaveBeenCalledWith('ROLLBACK');
    });

    it('accepts a "free" order without a signature only when it really costs nothing', async () => {
        payment = { id: 'pay-f', user_id: TEST_USER.id, plan_id: null, status: 'created', final_amount: 49900, billing_cycle: 'one_time',
            metadata: { resource_type: 'course', resource_id: COURSES[0] } };
        await expect(PaymentsV2Service.verifyAndActivate(TEST_USER.id, 'free_course_1', '', '')).rejects.toThrow('Payment verification failed');
        payment = { ...payment, final_amount: 0 };
        await expect(PaymentsV2Service.verifyAndActivate(TEST_USER.id, 'free_course_1', 'free', '')).resolves.toMatchObject({ success: true });
    });

    it('activates a course bought through the webhook the same way', async () => {
        payment = { id: 'pay-w', user_id: TEST_USER.id, plan_id: null, status: 'created', final_amount: 49900, billing_cycle: 'one_time',
            metadata: { resource_type: 'course', resource_id: COURSES[1] } };
        mockQuery.mockResolvedValue({ rows: [payment] });
        await PaymentsV2Service.handleWebhook('payment.captured', { payment: { entity: { order_id: 'order_w', id: 'pay_w' } } });
        expect(entitlementInserts()).toHaveLength(1);
        expect(sqlOf(clientQuery).some((s) => s.includes('insert into public.subscriptions') || s.includes('current_plan'))).toBe(false);
    });

    it('takes back only what a refunded payment bought', async () => {
        payment = { id: 'pay-r', user_id: TEST_USER.id, subscription_id: null };
        await PaymentsV2Service.handleWebhook('refund.created', { payment: { entity: { order_id: 'order_r', id: 'pay_r' } } });
        const sql = sqlOf(clientQuery);
        expect(sql.some((s) => s.includes('update public.user_entitlements set bool_value = false') )).toBe(true);
        expect(sql.some((s) => s.includes("current_plan = 'free'") || s.includes('update public.subscriptions'))).toBe(false);
    });

    it('cancels a plan on refund only when that payment paid for it', async () => {
        payment = { id: 'pay-s', user_id: TEST_USER.id, subscription_id: 'sub-9' };
        await PaymentsV2Service.handleWebhook('refund.created', { payment: { entity: { order_id: 'order_s', id: 'pay_s' } } });
        const call = clientQuery.mock.calls.find((c) => /current_plan = 'free'/.test(String(c[0])));
        expect(String(call?.[0])).toMatch(/active_subscription_id = \$2/);
        expect(call?.[1]).toEqual([TEST_USER.id, 'sub-9']);
    });
});

describe('bundle orders', () => {
    const route = (rows: Record<string, unknown[]>) => mockQuery.mockImplementation((sql: string) => {
        const s = sql.toLowerCase();
        for (const [k, v] of Object.entries(rows)) if (s.includes(k)) return Promise.resolve({ rows: v });
        return Promise.resolve({ rows: [{ id: 'payment-1' }] });
    });

    it('prices the bundle and fixes its courses on the order', async () => {
        route({ 'from public.course_bundles': [{ id: BUNDLE, title: 'Placement pack', price: 99900, currency: 'INR' }],
            'from public.course_bundle_items': COURSES.map((course_id) => ({ course_id })), 'from public.user_entitlements': [{ resource_id: COURSES[0] }] });
        const order = await PaymentsV2Service.createBundleOrder(TEST_USER.id, BUNDLE);
        expect(order).toMatchObject({ amount: 99900, bundle: { courses: 3 } });
        const insert = mockQuery.mock.calls.find((c) => /insert into public\.payments/i.test(String(c[0])));
        expect(insert?.[1][9]).toEqual({ purchase_kind: 'bundle', resource_type: 'bundle', resource_id: BUNDLE, course_ids: COURSES });
    });

    it('refuses a bundle the learner already fully owns', async () => {
        route({ 'from public.course_bundles': [{ id: BUNDLE, title: 'Pack', price: 99900 }],
            'from public.course_bundle_items': COURSES.map((course_id) => ({ course_id })), 'from public.user_entitlements': COURSES.map((resource_id) => ({ resource_id })) });
        await expect(PaymentsV2Service.createBundleOrder(TEST_USER.id, BUNDLE)).rejects.toThrow('You already have every course in this bundle');
    });

    it('refuses an unpublished or unknown bundle', async () => {
        route({ 'from public.course_bundles': [] });
        await expect(PaymentsV2Service.createBundleOrder(TEST_USER.id, BUNDLE)).rejects.toThrow('Bundle not found');
    });
});
