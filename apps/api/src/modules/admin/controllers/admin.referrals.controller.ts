import { Request, Response } from 'express';
import { supabase } from '../../../config/database';
import logger from '../../../config/logger';

export const getCustomReferrals = async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('user_referral_codes')
            .select(`*, users(full_name, email)`)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ data });
    } catch (e: any) {
        logger.error('Failed to get custom referrals:', e);
        res.status(500).json({ error: e.message });
    }
};

export const createCustomReferral = async (req: Request, res: Response) => {
    try {
        const { user_id, code, reward_amount, commission_percentage, is_primary } = req.body;
        
        // If this is set to primary, unset others for this user
        if (is_primary) {
            await supabase
                .from('user_referral_codes')
                .update({ is_primary: false })
                .eq('user_id', user_id);
        }

        const { data, error } = await supabase
            .from('user_referral_codes')
            .insert([{
                user_id,
                code,
                reward_amount,
                commission_percentage,
                is_primary: is_primary || false
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ success: true, data });
    } catch (e: any) {
        logger.error('Failed to create custom referral:', e);
        res.status(400).json({ error: e.message });
    }
};

export const updateCustomReferral = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { code, reward_amount, commission_percentage, is_primary, user_id } = req.body;

        if (is_primary) {
            await supabase
                .from('user_referral_codes')
                .update({ is_primary: false })
                .eq('user_id', user_id);
        }

        const { data, error } = await supabase
            .from('user_referral_codes')
            .update({
                code,
                reward_amount,
                commission_percentage,
                is_primary
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, data });
    } catch (e: any) {
        logger.error('Failed to update custom referral:', e);
        res.status(400).json({ error: e.message });
    }
};
