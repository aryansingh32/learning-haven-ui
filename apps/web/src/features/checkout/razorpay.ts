import { api } from '@/services/api.svc';

/**
 * Paying for an order with Razorpay, in the page (Razorpay's checkout is an overlay,
 * not a new window). Used by every purchase in the app: plans, courses, bundles.
 */

export interface PaymentOrder {
  razorpayOrderId: string;
  finalAmount: number; // paise
  amount?: number;
  discountAmount?: number;
  taxAmount?: number;
  currency?: string;
  keyId?: string;
}

export type PaymentOutcome = 'paid' | 'cancelled';

let loading: Promise<void> | null = null;
export function loadRazorpay(): Promise<void> {
  if ((window as any).Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => { loading = null; reject(new Error('Could not load the payment window. Check your connection and try again.')); };
    document.head.appendChild(script);
  });
  return loading;
}

/** The order the API wraps as { success, data }, or returns bare. */
export const orderOf = (res: unknown): PaymentOrder => ((res as { data?: PaymentOrder })?.data ?? res) as PaymentOrder;

async function verify(orderId: string, paymentId: string, signature: string) {
  await api.post('/v2/payments/verify', { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature });
}

/**
 * Takes the learner through payment and confirms it with the API. Free orders
 * (100% coupons, ₹0 bundles) are confirmed without opening Razorpay. Resolves
 * 'cancelled' if they close the payment window.
 */
export async function payOrder(
  order: PaymentOrder,
  details: { title: string; name?: string; email?: string; onFailedAttempt?: (message: string) => void },
): Promise<PaymentOutcome> {
  if (order.razorpayOrderId.startsWith('free_')) {
    await verify(order.razorpayOrderId, order.razorpayOrderId, 'free');
    return 'paid';
  }
  await loadRazorpay();
  return new Promise<PaymentOutcome>((resolve, reject) => {
    const rzp = new (window as any).Razorpay({
      key: order.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: order.finalAmount,
      currency: order.currency || 'INR',
      name: 'Forge',
      description: details.title,
      order_id: order.razorpayOrderId,
      prefill: { name: details.name || '', email: details.email || '' },
      theme: { color: '#f97316' },
      handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        try {
          await verify(response.razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature);
          resolve('paid');
        } catch {
          // Charged, but not confirmed yet: never say it failed, or they may pay twice.
          reject(new Error('Your payment went through and is still being confirmed. It will show up in a minute — please don\'t pay again.'));
        }
      },
      modal: { ondismiss: () => resolve('cancelled') },
    });
    // Razorpay keeps its window open after a failed attempt so the learner can try
    // another method; the purchase only ends on success or when they close it.
    rzp.on('payment.failed', (r: { error?: { description?: string } }) => {
      details.onFailedAttempt?.(r.error?.description || 'That payment failed. You have not been charged.');
    });
    rzp.open();
  });
}
