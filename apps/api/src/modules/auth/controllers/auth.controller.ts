import { Request, Response } from 'express';
import { supabase } from '../../../config/database';
import logger from '../../../config/logger';
import { ReferralsService } from '../../billing/services/referrals.service';
import {
  ok,
  created,
  badRequest,
  unauthorized,
  serverError,
} from '../../../utils/api-response';

export const signup = async (req: Request, res: Response) => {
    const { email, password, full_name, referral_code } = req.body;

    // Validation now handled by Zod middleware; this is a safety net
    if (!email || !password || !full_name) {
        return badRequest(res, 'Missing required fields: email, password, full_name');
    }

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name,
                },
            },
        });

        if (error) {
            logger.warn(`Signup failed for ${email}: ${error.message}`);
            return badRequest(res, error.message);
        }

        if (data.user) {
            // Create user profile in public.users table
            // Note: If using triggers, this might be redundant or cause conflict if not handled.
            // But based on the migration file, there is NO trigger on auth.users -> public.users.
            // So we MUST do it manually here.

            const { error: profileError } = await supabase
                .from('users')
                .insert([
                    {
                        id: data.user.id,
                        email: data.user.email,
                        full_name: full_name,
                        // other fields have defaults
                    },
                ]);

            if (profileError) {
                logger.error(`Failed to create user profile for ${data.user.id}: ${profileError.message}`);
                return serverError(res);
            }

            if (referral_code) {
                try {
                    await ReferralsService.applyReferralCode(data.user.id, referral_code, req.ip);
                } catch (refError) {
                    logger.warn(`Failed to apply referral code during signup for ${data.user.id}:`, refError);
                }
            }
        }

        return created(res, { message: 'User created successfully', user: data.user, session: data.session });
    } catch (err: unknown) {
        logger.error('Signup error', err);
        return serverError(res);
    }
};

export const signin = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    // Validation now handled by Zod middleware; this is a safety net
    if (!email || !password) {
        return badRequest(res, 'Missing email or password');
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            logger.warn(`Signin failed for ${email}: ${error.message}`);
            return unauthorized(res, error.message);
        }

        return ok(res, { session: data.session, user: data.user });
    } catch (err: unknown) {
        logger.error('Signin error', err);
        return serverError(res);
    }
};

export const refreshSession = async (req: Request, res: Response) => {
    const refresh_token = req.body?.refresh_token;

    if (!refresh_token || typeof refresh_token !== 'string') {
        return badRequest(res, 'refresh_token is required');
    }

    try {
        const { data, error } = await supabase.auth.refreshSession({ refresh_token });

        if (error || !data.session?.access_token) {
            logger.warn(`Session refresh failed: ${error?.message || 'no session'}`);
            return unauthorized(res, error?.message || 'Failed to refresh session');
        }

        return ok(res, {
            session: {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                expires_in: data.session.expires_in,
                expires_at: data.session.expires_at,
            },
        });
    } catch (err: unknown) {
        logger.error('Refresh session error', err);
        return serverError(res);
    }
};

export const signout = async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return badRequest(res, 'No token provided');

    const { error } = await supabase.auth.signOut({ scope: 'local' });

    if (error) {
        return serverError(res);
    }

    return ok(res, { message: 'Signed out successfully' });
};
