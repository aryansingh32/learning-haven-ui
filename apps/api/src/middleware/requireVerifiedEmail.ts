import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import logger from '../config/logger';
import { AccountService } from '../modules/auth/services/account.service';
import { fail, unauthorized } from '../utils/api-response';

/**
 * Actions that need a confirmed email address (slice W2-A1): paying, earning a
 * certificate, and publishing a portfolio. The email is where receipts,
 * invoices and certificates go and what a certificate's name is tied to.
 * (Claiming a college roster entry is enforced in the database by
 * campus.claim_roster_entries.) Fails open on an unexpected error so a
 * database hiccup doesn't block checkout; the database checks still apply.
 */
export const requireVerifiedEmail = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const id = req.user?.id;
    if (!id) return unauthorized(res);
    try {
        if (await AccountService.isEmailVerified(id)) return next();
        return fail(res, 403, 'EMAIL_NOT_VERIFIED', 'Verify your email address first. You can resend the link from Account settings.');
    } catch (error) {
        logger.warn('Email verification check failed; letting the request through', { error });
        return next();
    }
};
