import { Copy, Check, Gift, Trophy, ArrowUpRight, Users, Wallet, Crown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

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

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Referrals & Wallet</h1>
        <p className="text-sm text-muted-foreground mt-1">Invite friends and earn rewards</p>
      </div>

      {/* Hero Referral Card */}
      <div className="relative overflow-hidden rounded-2xl gradient-golden p-6 md:p-8">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-primary-foreground/10" />
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
            <button
              onClick={handleCopy}
              className={cn(
                "px-5 py-3 rounded-xl font-medium text-sm transition-all flex items-center gap-2 shadow-sm",
                copied ? "bg-primary-foreground text-primary" : "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30 border border-primary-foreground/20"
              )}
            >
              {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy</>}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Users, label: "Total Referrals", value: "5", color: "text-primary" },
          { icon: Wallet, label: "Total Earned", value: "₹350", color: "text-primary" },
          { icon: ArrowUpRight, label: "Available", value: "₹200", color: "text-success" },
          { icon: Trophy, label: "Rank", value: "#15", color: "text-primary" },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-2xl p-5 shadow-card border border-border">
            <stat.icon className={cn("h-5 w-5 mb-2", stat.color)} />
            <p className="font-display text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tiers */}
      <div className="bg-card rounded-2xl shadow-card border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Crown className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Tier Status</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {tiers.map((tier) => (
            <div key={tier.name} className={cn(
              "rounded-xl border-2 p-4 text-center transition-all",
              tier.active
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-secondary/50"
            )}>
              <p className="text-2xl mb-1">{tier.emoji}</p>
              <p className="font-display font-bold text-foreground">{tier.name}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{tier.min}–{tier.max === 999 ? "∞" : tier.max} referrals</p>
              {tier.active && <span className="inline-block mt-2 text-[10px] bg-primary text-primary-foreground px-2.5 py-0.5 rounded-full font-semibold">Current</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Referred Users */}
        <div className="bg-card rounded-2xl shadow-card border border-border p-5">
          <p className="text-sm font-semibold text-foreground mb-3">Referred Users</p>
          <div className="space-y-1.5">
            {referredUsers.map((u) => (
              <div key={u.name} className="flex items-center justify-between p-3 rounded-xl bg-secondary/60 hover:bg-secondary transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
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
                    u.status === "Active" ? "bg-success/15 text-success" : "bg-primary/15 text-primary"
                  )}>
                    {u.status}
                  </span>
                  <p className="text-xs font-semibold text-foreground mt-1">{u.earned}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Withdrawal + Leaderboard */}
        <div className="space-y-4">
          <div className="bg-card rounded-2xl shadow-card border border-border p-5">
            <p className="text-sm font-semibold text-foreground mb-3">UPI Withdrawal</p>
            <input
              type="text"
              placeholder="Enter UPI ID (e.g. name@upi)"
              className="w-full px-4 py-3 rounded-xl bg-secondary/60 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 mb-3"
            />
            <button className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity shadow-sm">
              Withdraw ₹200
            </button>
          </div>

          <div className="bg-card rounded-2xl shadow-card border border-border p-5">
            <p className="text-sm font-semibold text-foreground mb-3">Top Referrers</p>
            <div className="space-y-1.5">
              {leaderboard.map((u) => (
                <div key={u.rank} className={cn(
                  "flex items-center gap-3 p-3 rounded-xl transition-colors",
                  u.name === "You" ? "bg-primary/8 border border-primary/15" : "bg-secondary/60 hover:bg-secondary"
                )}>
                  <span className="font-display font-bold text-base w-7 text-center">
                    {u.rank === 1 ? "🥇" : u.rank === 2 ? "🥈" : `#${u.rank}`}
                  </span>
                  <span className={cn("flex-1 text-sm font-medium", u.name === "You" ? "text-primary" : "text-foreground")}>{u.name}</span>
                  <span className="text-xs font-semibold text-muted-foreground">{u.referrals} refs</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferralsPage;
