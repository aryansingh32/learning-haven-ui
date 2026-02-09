import { Copy, Check, Gift, Trophy, ArrowUpRight, Users, Wallet } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const tiers = [
  { name: "Bronze", min: 0, max: 5, color: "bg-amber-700/10 text-amber-700 border-amber-700/20" },
  { name: "Silver", min: 5, max: 15, color: "bg-muted text-muted-foreground border-border", active: true },
  { name: "Gold", min: 15, max: 999, color: "bg-primary/10 text-primary border-primary/20" },
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
        <h1 className="font-display text-2xl font-bold text-foreground">Referrals & Wallet</h1>
        <p className="text-sm text-muted-foreground mt-1">Invite friends and earn rewards</p>
      </div>

      {/* Referral Link Card */}
      <div className="bg-card rounded-2xl shadow-card border border-border p-6 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="h-5 w-5 text-primary" />
            <h2 className="font-display font-bold text-lg text-foreground">Your Referral Link</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Share this link and earn ₹100 for each active referral!</p>
          <div className="flex gap-2">
            <div className="flex-1 bg-secondary rounded-xl px-4 py-3 text-sm text-foreground font-mono truncate">
              {referralLink}
            </div>
            <button
              onClick={handleCopy}
              className={cn(
                "px-4 py-3 rounded-xl font-medium text-sm transition-all flex items-center gap-2",
                copied ? "bg-success text-primary-foreground" : "bg-primary text-primary-foreground hover:opacity-90"
              )}
            >
              {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy</>}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-2xl p-5 shadow-card border border-border text-center">
          <Users className="h-5 w-5 text-primary mx-auto mb-2" />
          <p className="font-display text-2xl font-bold text-foreground">5</p>
          <p className="text-xs text-muted-foreground">Total Referrals</p>
        </div>
        <div className="bg-card rounded-2xl p-5 shadow-card border border-border text-center">
          <Wallet className="h-5 w-5 text-primary mx-auto mb-2" />
          <p className="font-display text-2xl font-bold text-foreground">₹350</p>
          <p className="text-xs text-muted-foreground">Total Earned</p>
        </div>
        <div className="bg-card rounded-2xl p-5 shadow-card border border-border text-center">
          <ArrowUpRight className="h-5 w-5 text-success mx-auto mb-2" />
          <p className="font-display text-2xl font-bold text-foreground">₹200</p>
          <p className="text-xs text-muted-foreground">Available</p>
        </div>
        <div className="bg-card rounded-2xl p-5 shadow-card border border-border text-center">
          <Trophy className="h-5 w-5 text-primary mx-auto mb-2" />
          <p className="font-display text-2xl font-bold text-foreground">#15</p>
          <p className="text-xs text-muted-foreground">Rank</p>
        </div>
      </div>

      {/* Tiers */}
      <div className="bg-card rounded-2xl shadow-card border border-border p-5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Tier Status</p>
        <div className="grid grid-cols-3 gap-3">
          {tiers.map((tier) => (
            <div key={tier.name} className={cn("rounded-xl border-2 p-4 text-center transition-all", tier.color, tier.active && "ring-2 ring-primary/30")}>
              <p className="font-display font-bold text-lg">{tier.name}</p>
              <p className="text-xs mt-1">{tier.min}–{tier.max === 999 ? "∞" : tier.max} referrals</p>
              {tier.active && <span className="inline-block mt-2 text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium">Current</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Referred Users */}
        <div className="bg-card rounded-2xl shadow-card border border-border p-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Referred Users</p>
          <div className="space-y-2">
            {referredUsers.map((u) => (
              <div key={u.name} className="flex items-center justify-between p-3 rounded-xl bg-secondary">
                <div>
                  <p className="text-sm font-medium text-foreground">{u.name}</p>
                  <p className="text-[10px] text-muted-foreground">{u.date}</p>
                </div>
                <div className="text-right">
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-medium",
                    u.status === "Active" ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
                  )}>
                    {u.status}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">{u.earned}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Withdrawal + Leaderboard */}
        <div className="space-y-4">
          <div className="bg-card rounded-2xl shadow-card border border-border p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">UPI Withdrawal</p>
            <input
              type="text"
              placeholder="Enter UPI ID (e.g. name@upi)"
              className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 mb-3"
            />
            <button className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
              Withdraw ₹200
            </button>
          </div>

          <div className="bg-card rounded-2xl shadow-card border border-border p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Top Referrers</p>
            <div className="space-y-2">
              {leaderboard.map((u) => (
                <div key={u.rank} className={cn(
                  "flex items-center gap-3 p-3 rounded-xl",
                  u.name === "You" ? "bg-primary/10 border border-primary/20" : "bg-secondary"
                )}>
                  <span className="font-display font-bold text-lg w-8 text-center text-muted-foreground">#{u.rank}</span>
                  <span className="flex-1 text-sm font-medium text-foreground">{u.name}</span>
                  <span className="text-sm text-muted-foreground">{u.referrals} refs</span>
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
