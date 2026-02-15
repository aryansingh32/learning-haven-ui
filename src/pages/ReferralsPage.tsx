import { Copy, Check, Gift, Trophy, ArrowUpRight, Users, Wallet, Crown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from "recharts";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";

const earningsData = [
  { month: "Sep", earned: 0 },
  { month: "Oct", earned: 50 },
  { month: "Nov", earned: 100 },
  { month: "Dec", earned: 150 },
  { month: "Jan", earned: 250 },
  { month: "Feb", earned: 350 },
];

const tiers = [
  { name: "Bronze", min: 0, max: 5, emoji: "🥉", active: false },
  { name: "Silver", min: 5, max: 15, emoji: "🥈", active: true },
  { name: "Gold", min: 15, max: 999, emoji: "🥇", active: false },
];

const referredUsers = [
  { name: "Priya M.", date: "Jan 15, 2025", status: "Active", earned: "₹100" },
  { name: "Rahul K.", date: "Jan 20, 2025", status: "Active", earned: "₹100" },
  { name: "Sneha R.", date: "Feb 1, 2025", status: "Pending", earned: "₹50" },
  { name: "Amit S.", date: "Feb 5, 2025", status: "Active", earned: "₹100" },
  { name: "Kavya D.", date: "Feb 8, 2025", status: "Pending", earned: "₹0" },
];

const leaderboard = [
  { name: "Deepak V.", referrals: 23, rank: 1 },
  { name: "Meera S.", referrals: 18, rank: 2 },
  { name: "You", referrals: 5, rank: 15 },
];

const ReferralsPage = () => {
  const [copied, setCopied] = useState(false);
  const referralLink = "https://dsaos.app/ref/arjun2025";
  const totalEarned = useAnimatedCounter(350, 1200, 200);

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Referrals & Wallet</h1>
        <p className="text-sm text-muted-foreground mt-1">Invite friends and earn rewards</p>
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
            <h2 className="font-display font-bold text-lg text-primary-foreground">Your Referral Link</h2>
          </div>
          <p className="text-sm text-primary-foreground/80 mb-5">Share this link and earn ₹100 for each active referral!</p>
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
          { icon: Users, label: "Total Referrals", value: "5", color: "text-primary" },
          { icon: Wallet, label: "Total Earned", value: `₹${totalEarned}`, color: "text-primary" },
          { icon: ArrowUpRight, label: "Available", value: "₹200", color: "text-success" },
          { icon: Trophy, label: "Rank", value: "#15", color: "text-primary" },
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

      {/* Earnings Growth Chart */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card-glass rounded-2xl p-5 card-hover"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Earnings Growth</p>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-semibold">+40% this month</span>
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={earningsData}>
            <defs>
              <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(38,92%,50%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(38,92%,50%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: 11 }} />
            <Area type="monotone" dataKey="earned" stroke="hsl(38,92%,50%)" strokeWidth={2.5} fill="url(#earnGrad)" dot={{ fill: "hsl(38,92%,50%)", r: 3, strokeWidth: 0 }} animationDuration={1200} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Tiers */}
      <div className="card-glass rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Crown className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Tier Status</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {tiers.map((tier) => (
            <motion.div
              key={tier.name}
              whileHover={{ scale: 1.03, y: -2 }}
              className={cn(
                "rounded-xl border-2 p-4 text-center transition-all",
                tier.active
                  ? "border-primary card-layer-2 shadow-glow"
                  : "border-border bg-secondary/20"
              )}
            >
              <motion.p
                className="text-3xl mb-1"
                animate={tier.active ? { scale: [1, 1.15, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {tier.emoji}
              </motion.p>
              <p className="font-display font-bold text-foreground">{tier.name}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{tier.min}–{tier.max === 999 ? "∞" : tier.max} referrals</p>
              {tier.active && <span className="inline-block mt-2 text-[10px] gradient-golden text-primary-foreground px-2.5 py-0.5 rounded-full font-semibold shadow-sm">Current</span>}
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Referred Users */}
        <div className="card-glass rounded-2xl p-5">
          <p className="text-sm font-semibold text-foreground mb-3">Referred Users</p>
          <div className="space-y-1.5">
            {referredUsers.map((u, i) => (
              <motion.div
                key={u.name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                whileHover={{ x: 4 }}
                className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg gradient-golden flex items-center justify-center text-xs font-bold text-primary-foreground shadow-sm">
                    {u.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{u.name}</p>
                    <p className="text-[10px] text-muted-foreground">{u.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-lg font-semibold",
                    u.status === "Active" ? "bg-success/15 text-success border border-success/20" : "bg-primary/15 text-primary border border-primary/20"
                  )}>
                    {u.status}
                  </span>
                  <p className="text-xs font-semibold text-foreground mt-1">{u.earned}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Withdrawal + Leaderboard */}
        <div className="space-y-4">
          <div className="card-layer-2 rounded-2xl p-5">
            <p className="text-sm font-semibold text-foreground mb-3">💸 UPI Withdrawal</p>
            <input
              type="text"
              placeholder="Enter UPI ID (e.g. name@upi)"
              className="w-full px-4 py-3 rounded-xl bg-secondary/30 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 mb-3 transition-all"
            />
            <motion.button
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 rounded-xl gradient-golden text-primary-foreground font-medium text-sm transition-all shadow-lg hover:shadow-xl btn-ripple"
            >
              Withdraw ₹200
            </motion.button>
          </div>

          <div className="card-glass rounded-2xl p-5">
            <p className="text-sm font-semibold text-foreground mb-3">🏆 Top Referrers</p>
            <div className="space-y-1.5">
              {leaderboard.map((u) => (
                <motion.div
                  key={u.rank}
                  whileHover={{ x: 4 }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl transition-all",
                    u.name === "You" ? "card-layer-2 border border-primary/20" : "bg-secondary/30 hover:bg-secondary/50"
                  )}
                >
                  <span className="font-display font-bold text-base w-7 text-center">
                    {u.rank === 1 ? "🥇" : u.rank === 2 ? "🥈" : `#${u.rank}`}
                  </span>
                  <span className={cn("flex-1 text-sm font-medium", u.name === "You" ? "text-primary font-semibold" : "text-foreground")}>{u.name}</span>
                  <span className="text-xs font-semibold text-muted-foreground">{u.referrals} refs</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferralsPage;
