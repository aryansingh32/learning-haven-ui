import { z } from 'zod';

// Problems
export const getProblemsSchema = z.object({
    query: z.object({
        page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
        limit: z.string().regex(/^\d+$/).transform(Number).optional().default(20),
        difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
        topic: z.string().optional(),
        search: z.string().optional(),
        is_premium: z.string().transform(val => val === 'true').optional(),
    }),
});

export const getProblemSchema = z.object({
    params: z.object({
        slug: z.string().min(1),
    }),
});

export const submitSolutionSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
    body: z.object({
        code: z.string().min(1),
        language: z.enum(['javascript', 'python', 'java', 'cpp', 'go']),
        time_spent_seconds: z.number().int().min(0).optional(),
    }),
});

// User Profile
export const updateProfileSchema = z.object({
    body: z.object({
        full_name: z.string().min(1).max(100).optional(),
        avatar_url: z.string().url().optional(),
        phone: z.string().regex(/^\+?[1-9]\d{9,14}$/).optional(),
        preferences: z.record(z.string(), z.any()).optional(),
    }),
});

// Submissions
export const addNoteSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
    body: z.object({
        notes: z.string().max(5000),
    }),
});

export const toggleRevisionSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
});

// Payments
export const createOrderSchema = z.object({
    body: z.object({
        plan_id: z.enum(['basic-monthly', 'basic-yearly', 'pro-monthly', 'pro-yearly']),
    }),
});

export const verifyPaymentSchema = z.object({
    body: z.object({
        razorpay_order_id: z.string().min(1),
        razorpay_payment_id: z.string().min(1),
        razorpay_signature: z.string().min(1),
    }),
});

// Referrals
export const applyReferralSchema = z.object({
    body: z.object({
        referral_code: z.string().min(1).max(20),
    }),
});

export const withdrawalSchema = z.object({
    body: z.object({
        amount: z.number().int().min(100), // min ₹1 (100 paise)
        upi_id: z.string().min(5).max(50),
    }),
});

// AI Coach
export const aiChatSchema = z.object({
    body: z.object({
        message: z.string().min(1).max(5000),
        problem_id: z.string().uuid().optional(),
    }),
});

// Certificates
export const generateCertificateSchema = z.object({
    body: z.object({
        topic: z.string().min(1).max(100),
    }),
});

