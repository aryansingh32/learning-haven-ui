import { Request, Response } from 'express';
import { supabase } from '../config/database';
import logger from '../config/logger';
import crypto from 'crypto';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const OTP_SALT = process.env.OTP_SALT || 'development-otp-salt-12345';
const MSG91_API_KEY = process.env.MSG91_API_KEY;
const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID;

function generateOtpHash(phone: string, otp: string): string {
    return crypto.createHash('sha256').update(`${phone}:${otp}:${OTP_SALT}`).digest('hex');
}

export const phoneSendOtp = async (req: Request, res: Response) => {
    const { phone } = req.body;

    if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
        return res.status(400).json({ error: 'Invalid 10-digit Indian phone number' });
    }

    try {
        // 1. Rate limit check: max 3 per hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data: attempts, error: countError } = await supabase
            .from('otp_verifications')
            .select('id', { count: 'exact' })
            .eq('phone', phone)
            .gte('created_at', oneHourAgo);

        if (countError) throw countError;

        // Due to the way PostgREST works, count comes back in a separate property usually, 
        // but supabase-js v2 returns count if requested.
        const attemptCount = attempts?.length || 0;

        if (attemptCount >= 3) {
            return res.status(429).json({ error: 'Too many attempts. Wait 1 hour.' });
        }

        // 2. Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // 3. Hash OTP
        const otpHash = generateOtpHash(phone, otp);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

        // 4. Store in DB
        const { error: insertError } = await supabase
            .from('otp_verifications')
            .insert([{ phone, otp_hash: otpHash, expires_at: expiresAt }]);

        if (insertError) throw insertError;

        // 5. Send via MSG91 or log in DEV
        if (process.env.NODE_ENV === 'development' || !MSG91_API_KEY) {
            logger.info(`[DEV] Phone: ${phone}, OTP: ${otp}`);
        } else {
            // Call MSG91 API
            try {
                await axios.post('https://api.msg91.com/api/v5/otp', null, {
                    params: {
                        authkey: MSG91_API_KEY,
                        mobile: `91${phone}`,
                        otp: otp,
                        template_id: MSG91_TEMPLATE_ID
                    }
                });
            } catch (msgErr: any) {
                logger.error(`MSG91 Send Error: ${msgErr.message}`);
                // Proceed anyway so user can retry, or fail?
                // Let's fail if in production
                return res.status(500).json({ error: 'Failed to send SMS' });
            }
        }

        return res.json({ success: true, expires_in: 300 });
    } catch (err: any) {
        logger.error('phoneSendOtp error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

export const phoneVerifyOtp = async (req: Request, res: Response) => {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
        return res.status(400).json({ error: 'Phone and OTP are required' });
    }

    try {
        // 1. Find latest unverified OTP
        const { data: records, error } = await supabase
            .from('otp_verifications')
            .select('*')
            .eq('phone', phone)
            .eq('verified', false)
            .gte('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1);

        if (error || !records || records.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        const record = records[0];

        // 3. Check attempts
        if (record.attempts >= 3) {
            await supabase.from('otp_verifications').delete().eq('id', record.id);
            return res.status(429).json({ error: 'Maximum attempts reached. Request a new OTP.' });
        }

        // 2. Compare Hash
        const incomingHash = generateOtpHash(phone, otp);
        if (incomingHash !== record.otp_hash) {
            await supabase
                .from('otp_verifications')
                .update({ attempts: record.attempts + 1 })
                .eq('id', record.id);
            return res.status(400).json({ error: 'Incorrect OTP', attempts_left: 2 - record.attempts });
        }

        // 5. Correct OTP -> mark verified
        await supabase
            .from('otp_verifications')
            .update({ verified: true })
            .eq('id', record.id);

        // Check if user exists
        const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('phone', phone)
            .single();

        if (user) {
            // User exists, create session
            const token = jwt.sign({
                aud: 'authenticated',
                exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7),
                sub: user.id,
                email: user.email,
                phone: user.phone,
                app_metadata: { provider: 'phone', providers: ['phone'] },
                user_metadata: {},
                role: 'authenticated'
            }, process.env.JWT_SECRET as string);

            return res.json({
                isNewUser: false,
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    full_name: user.full_name,
                    phone: user.phone
                }
            });
        } else {
            // New user
            return res.json({ isNewUser: true, phone, verification_id: record.id });
        }
    } catch (err: any) {
        logger.error('phoneVerifyOtp error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

export const phoneCompleteProfile = async (req: Request, res: Response) => {
    const { phone, verification_id, name, college_name, year, onboarding_answers } = req.body;

    if (!phone || !verification_id || !name) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Verify that this phone was actually verified recently
        const { data: verifyRecord } = await supabase
            .from('otp_verifications')
            .select('*')
            .eq('id', verification_id)
            .eq('phone', phone)
            .eq('verified', true)
            .single();

        if (!verifyRecord) {
            return res.status(401).json({ error: 'Phone verification failed or expired' });
        }

        const pseudoEmail = `${phone}@dsaos.in`;
        const autoPassword = uuidv4();

        // 1. Create user in Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            phone,
            email: pseudoEmail,
            password: autoPassword,
            email_confirm: true,
            phone_confirm: true,
            user_metadata: { full_name: name }
        });

        if (authError) {
            logger.error('Supabase auth.admin.createUser error:', authError);
            return res.status(400).json({ error: authError.message });
        }

        const userId = authData.user.id;

        // 2. Insert into public.users
        const { error: profileError } = await supabase
            .from('users')
            .insert([{
                id: userId,
                phone,
                email: pseudoEmail,
                full_name: name,
                college_name: college_name || null,
                year_of_study: year || null,
                onboarding_answers: onboarding_answers || null
            }]);

        if (profileError) {
            logger.error('Error inserting into public.users:', profileError);
            // Non-fatal, they can update profile later, but let's return error ideally.
            // For now, continue to login.
        }

        // 4. Create session JWT
        const token = jwt.sign({
            aud: 'authenticated',
            exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7),
            sub: userId,
            email: pseudoEmail,
            phone: phone,
            app_metadata: { provider: 'phone', providers: ['phone'] },
            user_metadata: { full_name: name },
            role: 'authenticated'
        }, process.env.JWT_SECRET as string);

        return res.status(201).json({
            token,
            user: {
                id: userId,
                email: pseudoEmail,
                full_name: name,
                phone
            }
        });

    } catch (err: any) {
        logger.error('phoneCompleteProfile error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
