import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from './env';

const razorpay = new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
});

/**
 * Constant-time hex-string comparison. Returns false (never throws) on
 * length mismatch instead of leaking timing information via `===`.
 */
function safeCompareHex(expectedHex: string, actualHex: string): boolean {
    const expected = Buffer.from(expectedHex, 'hex');
    const actual = Buffer.from(actualHex, 'hex');
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
}

/**
 * Verify Razorpay payment signature
 */
export function verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string
): boolean {
    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
        .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest('hex');
    return safeCompareHex(expectedSignature, signature);
}

/**
 * Verify Razorpay webhook signature.
 * Fails closed (rejects everything) if the webhook secret isn't configured —
 * an empty-string HMAC key would let anyone forge a valid signature and post
 * fake "payment captured" webhooks to grant themselves paid access.
 */
export function verifyWebhookSignature(
    body: string,
    signature: string
): boolean {
    if (!env.RAZORPAY_WEBHOOK_SECRET) {
        return false;
    }
    const expectedSignature = crypto
        .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
        .update(body)
        .digest('hex');
    return safeCompareHex(expectedSignature, signature);
}

export default razorpay;
