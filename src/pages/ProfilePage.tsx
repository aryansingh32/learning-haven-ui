import { Star, Flame, Trophy, Settings, Globe, ChevronRight, Shield, Bell, HelpCircle, Mail, Moon, Sun, Award, Zap, Target } from "lucide-react";
import { ProgressRing } from "@/components/ProgressRing";
import { useTheme } from "@/hooks/useTheme";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

const stats = [
  { label: "Problems Solved", value: "187" },
  { label: "Easy", value: "85" },
  { label: "Medium", value: "72" },
  { label: "Hard", value: "30" },
  { label: "Contests", value: "12" },
  { label: "Certificates", value: "3" },
];

const languages = ["JavaScript", "Python", "C++", "Java", "Go"];

const badges = [
  { name: "First Blood", emoji: "⚔️", desc: "Solved first problem", unlocked: true },
  { name: "Streak Master", emoji: "🔥", desc: "14-day streak", unlocked: true },
  { name: "Speed Demon", emoji: "⚡", desc: "Solve in <5 min", unlocked: true },
  { name: "Hard Crusher", emoji: "💎", desc: "10 Hard problems", unlocked: false },
  { name: "Contest King", emoji: "👑", desc: "Win a contest", unlocked: false },
  { name: "Centurion", emoji: "💯", desc: "100 problems", unlocked: true },
];

const sparklineData = [
  { v: 3 }, { v: 5 }, { v: 8 }, { v: 4 }, { v: 12 }, { v: 15 }, { v: 10 },
];

const settingsItems = [
  { label: "Notifications", description: "Manage push notifications", icon: Bell },
  { label: "Privacy", description: "Control data sharing preferences", icon: Shield },
  { label: "Account", description: "Email, password & security", icon: Mail },
  { label: "Help & Support", description: "FAQs and contact support", icon: HelpCircle },
];

const ProfilePage = () => {
  const { theme, toggleTheme } = useTheme();
  const xpCount = useAnimatedCounter(2150, 1200, 200);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-glass rounded-2xl relative overflow-hidden"
      >
        <div className="h-28 gradient-golden opacity-30" />
        <div className="px-6 pb-6 -mt-12 relative z-10">
          <div className="relative group cursor-pointer inline-block">
            <div className="h-24 w-24 rounded-2xl gradient-golden flex items-center justify-center text-primary-foreground font-display font-bold text-4xl ring-4 ring-card shadow-lg group-hover:shadow-xl transition-shadow">
              A
            </div>
            <div className="absolute inset-0 rounded-2xl bg-foreground/0 group-hover:bg-foreground/10 transition-colors flex items-center justify-center">
              <span className="text-primary-foreground text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
            </div>
          </div>
          <h1 className="font-display text-xl font-bold text-foreground mt-3">Arjun Sharma</h1>
          <p className="text-sm text-muted-foreground">arjun@email.com</p>
          <div className="flex items-center gap-5 mt-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Star className="h-4 w-4 text-primary" /> {xpCount.toLocaleString()} XP
            </span>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Flame className="h-4 w-4 text-destructive" /> 14 Day Streak
            </span>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Trophy className="h-4 w-4 text-primary" /> Level 8
            </span>
          </div>
        </div>
      </motion.div>

      {/* XP Progress */}
      <div className="card-layer-2 rounded-2xl p-5 flex items-center gap-5">
        <ProgressRing value={75} size={80} strokeWidth={8} label="75%" sublabel="to Lvl 9" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Level 8 → Level 9</p>
          <p className="text-xs text-muted-foreground mt-0.5">{xpCount.toLocaleString()} / 3,000 XP</p>
          <div className="w-full h-3 bg-secondary rounded-full mt-2.5 overflow-hidden">
            <motion.div
              className="h-full gradient-golden rounded-full"
              initial={{ width: 0 }}
              animate={{ width: "72%" }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      {/* Weekly Performance Sparkline */}
      <div className="card-glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-foreground">📈 Weekly Performance</p>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-semibold">+25% vs last week</span>
        </div>
        <ResponsiveContainer width="100%" height={60}>
          <AreaChart data={sparklineData}>
            <defs>
              <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(38,92%,50%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(38,92%,50%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke="hsl(38,92%,50%)" strokeWidth={2} fill="url(#sparkGrad)" dot={false} animationDuration={1200} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Achievement Badges */}
      <div className="card-glass rounded-2xl p-5">
        <p className="text-sm font-semibold text-foreground mb-3">🏅 Achievements</p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5">
          {badges.map((badge, i) => (
            <motion.div
              key={badge.name}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.06 }}
              whileHover={badge.unlocked ? { scale: 1.1, y: -4 } : {}}
              className={cn(
                "text-center p-3 rounded-xl transition-all cursor-pointer",
                badge.unlocked ? "card-layer-2 shadow-sm hover:shadow-glow" : "bg-secondary/30 opacity-40 grayscale"
              )}
            >
              <p className="text-2xl mb-1">{badge.emoji}</p>
              <p className="text-[9px] font-semibold text-foreground leading-tight">{badge.name}</p>
              <p className="text-[8px] text-muted-foreground mt-0.5">{badge.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="card-glass rounded-2xl p-5">
        <p className="text-sm font-semibold text-foreground mb-3">📊 Statistics</p>
        <div className="grid grid-cols-3 gap-2.5">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
              className="text-center p-3.5 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-all"
            >
              <p className="font-display text-xl font-bold text-foreground">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Theme Toggle */}
      <div className="card-glass rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div key={theme} initial={{ rotate: -30, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}>
              {theme === "light" ? <Sun className="h-5 w-5 text-primary" /> : <Moon className="h-5 w-5 text-primary" />}
            </motion.div>
            <div>
              <p className="text-sm font-semibold text-foreground">Appearance</p>
              <p className="text-xs text-muted-foreground">{theme === "light" ? "Light" : "Dark"} mode is active</p>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={toggleTheme}
            className={cn(
              "relative w-14 h-7 rounded-full transition-colors duration-300",
              theme === "dark" ? "bg-primary" : "bg-secondary"
            )}
          >
            <motion.div
              className="absolute top-0.5 h-6 w-6 rounded-full bg-card shadow-md"
              animate={{ left: theme === "dark" ? "calc(100% - 1.625rem)" : "0.125rem" }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </motion.button>
        </div>
      </div>

      {/* Language Selector */}
      <div className="card-glass rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Preferred Language</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {languages.map((lang, i) => (
            <motion.button
              key={lang}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                i === 0 ? "gradient-golden text-primary-foreground shadow-md" : "bg-secondary/40 text-secondary-foreground hover:bg-secondary border border-border/40"
              )}
            >
              {lang}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div className="card-glass rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Settings className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Settings</p>
        </div>
        <div className="space-y-1">
          {settingsItems.map((item) => (
            <motion.button
              key={item.label}
              whileHover={{ x: 4 }}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl hover:bg-secondary/30 transition-all text-left group"
            >
              <div className="h-9 w-9 rounded-lg bg-secondary/50 flex items-center justify-center text-primary group-hover:gradient-golden group-hover:text-primary-foreground transition-all flex-shrink-0">
                <item.icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
