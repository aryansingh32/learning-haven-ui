import { supabase } from '../config/database';
import { CacheService } from './cache.service';
import logger from '../config/logger';

const REFERRAL_REWARD_AMOUNT = 10000; // ₹100 in paise
const FRAUD_SCORE_THRESHOLD = 70;

export class ReferralsService {
    /**
     * Get user's referral info (code + stats)
     */
    static async getReferralInfo(userId: string) {
        try {
            // Get user's referral code
            const { data: user } = await supabase
                .from('users')
                .select('referral_code, wallet_balance')
                .eq('id', userId)
                .single();

            if (!user) throw new Error('User not found');

            // Get referral stats
            const { data: referrals } = await supabase
                .from('referrals')
                .select('id, referred_user_id, status, earned_amount, created_at, activated_at')
                .eq('referrer_id', userId)
                .order('created_at', { ascending: false });

            const stats = {
                total_referrals: referrals?.length || 0,
                active_referrals: referrals?.filter(r => r.status === 'active' || r.status === 'paid').length || 0,
                pending_referrals: referrals?.filter(r => r.status === 'pending').length || 0,
                total_earned: referrals?.reduce((sum, r) => sum + (r.earned_amount || 0), 0) || 0,
                wallet_balance: user.wallet_balance || 0,
            };

            // Get referred user names
            const referralDetails = [];
            if (referrals && referrals.length > 0) {
                for (const ref of referrals) {
                    const { data: refUser } = await supabase
                        .from('users')
                        .select('full_name, email')
                        .eq('id', ref.referred_user_id)
                        .single();

                    referralDetails.push({
                        id: ref.id,
                        name: refUser?.full_name || 'Unknown',
                        email: refUser?.email || '',
                        status: ref.status,
                        earned: ref.earned_amount,
                        date: ref.created_at,
                        activated_at: ref.activated_at,
                    });
                }
            }

            return {
                referral_code: user.referral_code,
                referral_link: `${process.env.FRONTEND_URL}/signup?ref=${user.referral_code}`,
                stats,
                referrals: referralDetails,
            };
        } catch (error) {
            logger.error('Get referral info error:', { userId, error });
            throw new Error('Failed to fetch referral info');
        }
    }

    /**
     * Apply referral code during signup
     */
    static async applyReferralCode(
        newUserId: string,
        referralCode: string,
        signupIp?: string,
        deviceFingerprint?: string
    ) {
        try {
            // Find the referrer
            const { data: referrer } = await supabase
                .from('users')
                .select('id')
                .eq('referral_code', referralCode)
                .single();

            if (!referrer) {
                throw new Error('Invalid referral code');
            }

            // Can't refer yourself
            if (referrer.id === newUserId) {
                throw new Error('Cannot use your own referral code');
            }

            // Check for existing referral
            const { data: existing } = await supabase
                .from('referrals')
                .select('id')
                .eq('referred_user_id', newUserId)
                .single();

            if (existing) {
                throw new Error('Referral already applied');
            }

            // Fraud detection
            const fraudScore = await this.calculateFraudScore(
                referrer.id,
                newUserId,
                signupIp,
                deviceFingerprint
            );

            const isSuspicious = fraudScore >= FRAUD_SCORE_THRESHOLD;

            // Create referral record
            await supabase.from('referrals').insert({
                referrer_id: referrer.id,
                referred_user_id: newUserId,
                status: isSuspicious ? 'pending' : 'pending', // all start pending, activate on first paid action
                is_suspicious: isSuspicious,
                fraud_score: fraudScore,
                signup_ip: signupIp,
                signup_device_fingerprint: deviceFingerprint,
            });

            // Update referred_by on new user
            await supabase
                .from('users')
                .update({ referred_by: referrer.id })
                .eq('id', newUserId);

            logger.info('Referral applied', {
                referrer: referrer.id,
                referred: newUserId,
                fraudScore,
                isSuspicious,
            });

            return { success: true, message: 'Referral code applied successfully' };
        } catch (error: any) {
            logger.error('Apply referral error:', { newUserId, referralCode, error: error.message });
            throw error;
        }
    }

    /**
     * Activate referral (called when referred user makes first purchase)
     */
    static async activateReferral(referredUserId: string) {
        try {
            const { data: referral } = await supabase
                .from('referrals')
                .select('*')
                .eq('referred_user_id', referredUserId)
                .eq('status', 'pending')
                .single();

            if (!referral) return; // No pending referral

            if (referral.is_suspicious) {
                logger.warn('Suspicious referral skipped for activation', { referral: referral.id });
                return;
            }

            // Activate and credit reward
            await supabase
                .from('referrals')
                .update({
                    status: 'active',
                    earned_amount: REFERRAL_REWARD_AMOUNT,
                    activated_at: new Date().toISOString(),
                })
                .eq('id', referral.id);

            // Credit referrer's wallet
            const { data: referrer } = await supabase
                .from('users')
                .select('wallet_balance')
                .eq('id', referral.referrer_id)
                .single();

            if (referrer) {
                await supabase
                    .from('users')
                    .update({
                        wallet_balance: (referrer.wallet_balance || 0) + REFERRAL_REWARD_AMOUNT,
                    })
                    .eq('id', referral.referrer_id);
            }

            // Clear cache
            await CacheService.delPattern(`user:${referral.referrer_id}:*`);

            logger.info('Referral activated', {
                referralId: referral.id,
                referrer: referral.referrer_id,
                amount: REFERRAL_REWARD_AMOUNT,
            });
        } catch (error) {
            logger.error('Activate referral error:', { referredUserId, error });
        }
    }

    /**
     * Get referral leaderboard
     */
    static async getReferralLeaderboard(limit: number = 10) {
        try {
            const cached = await CacheService.get<any>('referral:leaderboard');
            if (cached) return cached;

            const { data } = await supabase
                .from('referrals')
                .select('referrer_id')
                .in('status', ['active', 'paid']);

            // Count referrals per user
            const counts: Record<string, number> = {};
            data?.forEach(r => {
                counts[r.referrer_id] = (counts[r.referrer_id] || 0) + 1;
            });

            // Sort and get top users
            const topReferrers = Object.entries(counts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, limit);

            const leaderboard = [];
            for (const [userId, count] of topReferrers) {
                const { data: user } = await supabase
                    .from('users')
                    .select('full_name')
                    .eq('id', userId)
                    .single();

                leaderboard.push({
                    name: user?.full_name || 'Anonymous',
                    referrals: count,
                    rank: leaderboard.length + 1,
                });
            }

            await CacheService.set('referral:leaderboard', leaderboard, 300);

            return leaderboard;
        } catch (error) {
            logger.error('Referral leaderboard error:', error);
            throw new Error('Failed to fetch referral leaderboard');
        }
    }

    /**
     * Request wallet withdrawal
     */
    static async requestWithdrawal(userId: string, amount: number, upiId: string) {
        try {
            const { data: user } = await supabase
                .from('users')
                .select('wallet_balance')
                .eq('id', userId)
                .single();

            if (!user) throw new Error('User not found');

            if ((user.wallet_balance || 0) < amount) {
                throw new Error('Insufficient wallet balance');
            }

            if (amount < 100) {
                throw new Error('Minimum withdrawal amount is ₹1');
            }

            // Create withdrawal request
            const { data: withdrawal } = await supabase
                .from('withdrawals')
                .insert({
                    user_id: userId,
                    amount,
                    upi_id: upiId,
                    status: 'pending',
                })
                .select()
                .single();

            // Deduct from wallet
            await supabase
                .from('users')
                .update({ wallet_balance: (user.wallet_balance || 0) - amount })
                .eq('id', userId);

            await CacheService.delPattern(`user:${userId}:*`);

            logger.info('Withdrawal requested', { userId, amount, withdrawalId: withdrawal?.id });

            return withdrawal;
        } catch (error: any) {
            logger.error('Withdrawal request error:', { userId, error: error.message });
            throw error;
        }
    }

    /**
     * Simple fraud detection scoring
     */
    private static async calculateFraudScore(
        referrerId: string,
        newUserId: string,
        signupIp?: string,
        deviceFingerprint?: string
    ): Promise<number> {
        let score = 0;

        try {
            // Check 1: Same IP as referrer's recent referrals
            if (signupIp) {
                const { data: sameIp } = await supabase
                    .from('referrals')
                    .select('id')
                    .eq('referrer_id', referrerId)
                    .eq('signup_ip', signupIp);

                if (sameIp && sameIp.length > 0) {
                    score += 40; // High risk: same IP
                }
            }

            // Check 2: Same device fingerprint
            if (deviceFingerprint) {
                const { data: sameDevice } = await supabase
                    .from('referrals')
                    .select('id')
                    .eq('referrer_id', referrerId)
                    .eq('signup_device_fingerprint', deviceFingerprint);

                if (sameDevice && sameDevice.length > 0) {
                    score += 50; // Very high risk: same device
                }
            }

            // Check 3: Too many referrals in short time
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            const { data: recentRefs } = await supabase
                .from('referrals')
                .select('id')
                .eq('referrer_id', referrerId)
                .gte('created_at', oneHourAgo);

            if (recentRefs && recentRefs.length >= 5) {
                score += 30; // Suspicious: too many in 1 hour
            }
        } catch (error) {
            logger.error('Fraud score calculation error:', error);
        }

        return Math.min(score, 100);
    }
}
