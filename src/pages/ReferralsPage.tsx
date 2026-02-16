import { Copy, Check, Gift, Trophy, ArrowUpRight, Users, Wallet, Crown, TrendingUp, Info } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from "recharts";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";
import { useApiQuery, useApiMutation } from "@/hooks/useApi";
import { Skeleton } from "@/components/ui/skeleton";

const tiers = [
  { name: "Bronze", min: 0, max: 2, emoji: "🥉" },
  { name: "Silver", min: 3, max: 9, emoji: "🥈" },
  { name: "Gold", min: 10, max: 999, emoji: "🥇" },
];

const ReferralsPage = () => {
  const [copied, setCopied] = useState(false);
  const [upiId, setUpiId] = useState("");

  // 1. Fetch Referral Info
  const { data: refInfo, isLoading: refLoading, refetch: refetchInfo } = useApiQuery<any>(
    ['referral-info'],
    '/referrals/info'
  );

  // 2. Fetch Leaderboard
  const { data: leaderboard, isLoading: lbLoading } = useApiQuery<any[]>(
    ['referral-leaderboard'],
    '/referrals/leaderboard'
  );

  // 3. Withdrawal Mutation
  const withdrawMutation = useApiMutation<any, { amount: number; upi_id: string }>(
    '/referrals/withdraw',
    'post'
  );

  const referralLink = `${window.location.origin}/signup?ref=${refInfo?.referral_code || ""}`;
  const totalEarned = useAnimatedCounter(0, refInfo?.wallet?.total_earned || 0, 800);
  const currentBalance = refInfo?.wallet?.balance || 0;

  const currentTier = tiers.find(t =>
    (refInfo?.referral_count || 0) >= t.min && (refInfo?.referral_count || 0) <= t.max
  ) || tiers[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWithdraw = async () => {
    if (!upiId.includes("@")) {
      alert("Please enter a valid UPI ID");
      return;
    }
    if (currentBalance < 1) {
      alert("Minimum withdrawal is ₹1");
      return;
    }

    try {
      await withdrawMutation.mutateAsync({
        amount: currentBalance,
        upi_id: upiId
      });
      alert("Withdrawal request submitted successfully!");
      refetchInfo();
      setUpiId("");
    } catch (error: any) {
      alert(error.response?.data?.error || "Withdrawal failed");
    }
  };

  if (refLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-5">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Referrals & Wallet</h1>
        <p className="text-sm text-muted-foreground mt-1">Invite friends and earn real rewards</p>
      </div>

      {/* Hero Referral Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl gradient-golden p-6 md:p-8 shine-sweep"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary-foreground/15" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="h-5 w-5 text-primary-foreground" />
            <h2 className="font-display font-bold text-lg text-primary-foreground">Your Referral Code: <span className="font-mono">{refInfo?.referral_code}</span></h2>
          </div>
          <p className="text-sm text-primary-foreground/80 mb-5">Share this link and earn ₹100 for each friend who goes Pro!</p>
          <div className="flex gap-2">
            <div className="flex-1 bg-primary-foreground/15 backdrop-blur-sm rounded-xl px-4 py-3 text-sm text-primary-foreground font-mono truncate border border-primary-foreground/20">
              {referralLink}
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleCopy}
              className={cn(
                "px-5 py-3 rounded-xl font-medium text-sm transition-all flex items-center gap-2 shadow-md btn-ripple",
                copied ? "bg-primary-foreground text-primary" : "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30 border border-primary-foreground/20"
              )}
            >
              {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy</>}
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Users, label: "Total Referrals", value: refInfo?.referral_count || 0, color: "text-primary" },
          { icon: Wallet, label: "Total Earned", value: `₹${totalEarned}`, color: "text-primary" },
          { icon: ArrowUpRight, label: "Available", value: `₹${currentBalance}`, color: "text-success" },
          { icon: Trophy, label: "Tier", value: currentTier.name, color: "text-primary" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="card-glass rounded-2xl p-5 card-hover"
          >
            <stat.icon className={cn("h-5 w-5 mb-2", stat.color)} />
            <p className="font-display text-2xl font-bold text-foreground tabular-nums">{stat.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Tiers */}
      <div className="card-glass rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Crown className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Tier Status</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {tiers.map((tier) => {
            const isActive = currentTier.name === tier.name;
            return (
              <motion.div
                key={tier.name}
                whileHover={{ scale: 1.03, y: -2 }}
                className={cn(
                  "rounded-xl border-2 p-4 text-center transition-all",
                  isActive
                    ? "border-primary card-layer-2 shadow-glow"
                    : "border-border bg-secondary/20 opacity-60"
                )}
              >
                <motion.p
                  className="text-3xl mb-1"
                  animate={isActive ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {tier.emoji}
                </motion.p>
                <p className="font-display font-bold text-foreground">{tier.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{tier.min}–{tier.max === 999 ? "∞" : tier.max} referrals</p>
                {isActive && <span className="inline-block mt-2 text-[10px] gradient-golden text-primary-foreground px-2.5 py-0.5 rounded-full font-semibold shadow-sm">Current</span>}
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Referred Users */}
        <div className="card-glass rounded-2xl p-5">
          <p className="text-sm font-semibold text-foreground mb-3">Recent Referrals</p>
          <div className="space-y-1.5 h-[300px] overflow-y-auto pr-1">
            {refInfo?.referrals?.length > 0 ? (
              refInfo.referrals.map((u: any, i: number) => (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-all border border-border/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg gradient-golden flex items-center justify-center text-xs font-bold text-primary-foreground shadow-sm">
                      {u.referred_user?.full_name?.charAt(0) || "U"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{u.referred_user?.full_name || "New User"}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-lg font-semibold",
                      u.status === 'completed' ? "bg-success/15 text-success border border-success/20" : "bg-primary/15 text-primary border border-primary/20"
                    )}>
                      {u.status === 'completed' ? 'Active' : 'Pending'}
                    </span>
                    <p className="text-xs font-semibold text-foreground mt-1">₹{u.reward_amount || 0}</p>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full opacity-40 italic text-sm text-center">
                <Users className="h-8 w-8 mb-2" />
                No referrals yet.<br />Start sharing your link!
              </div>
            )}
          </div>
        </div>

        {/* Withdrawal + Leaderboard */}
        <div className="space-y-4">
          <div className="card-layer-2 rounded-2xl p-5 border border-primary/10">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">💸 UPI Withdrawal</p>
              <div className="group relative">
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-popover text-[10px] rounded-lg shadow-xl border border-border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                  Withdrawals processed within 24-48 hours. Min ₹1.
                </div>
              </div>
            </div>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="Enter UPI ID (e.g. name@okaxis)"
              className="w-full px-4 py-3 rounded-xl bg-secondary/30 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 mb-3 transition-all"
            />
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleWithdraw}
              disabled={withdrawMutation.isPending || currentBalance < 1}
              className="w-full py-3 rounded-xl gradient-golden text-primary-foreground font-medium text-sm transition-all shadow-lg hover:shadow-xl btn-ripple disabled:grayscale disabled:opacity-50"
            >
              {withdrawMutation.isPending ? "Processing..." : `Withdraw ₹${currentBalance}`}
            </motion.button>
          </div>

          <div className="card-glass rounded-2xl p-5">
            <p className="text-sm font-semibold text-foreground mb-3">🏆 Top Referrers</p>
            <div className="space-y-1.5">
              {lbLoading ? (
                [1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)
              ) : (
                leaderboard?.map((u, i) => (
                  <motion.div
                    key={u.user_id}
                    whileHover={{ x: 4 }}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl transition-all",
                      u.isMe ? "card-layer-2 border border-primary/20" : "bg-secondary/30 hover:bg-secondary/50"
                    )}
                  >
                    <span className="font-display font-bold text-base w-7 text-center">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </span>
                    <span className={cn("flex-1 text-sm font-medium", u.isMe ? "text-primary font-semibold" : "text-foreground truncate")}>
                      {u.user?.full_name || "Top Referrer"}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">{u.referral_count} refs</span>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferralsPage;
