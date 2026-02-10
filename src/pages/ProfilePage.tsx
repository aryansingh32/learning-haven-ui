import { Star, Flame, Trophy, Settings, Globe, ChevronRight, Shield, Bell, HelpCircle, Mail, Moon, Sun } from "lucide-react";
import { ProgressRing } from "@/components/ProgressRing";
import { useTheme } from "@/hooks/useTheme";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const stats = [
  { label: "Problems Solved", value: "187" },
  { label: "Easy", value: "85" },
  { label: "Medium", value: "72" },
  { label: "Hard", value: "30" },
  { label: "Contests", value: "12" },
  { label: "Certificates", value: "3" },
];

const languages = ["JavaScript", "Python", "C++", "Java", "Go"];

const settingsItems = [
  { label: "Notifications", description: "Manage push notifications", icon: Bell },
  { label: "Privacy", description: "Control data sharing preferences", icon: Shield },
  { label: "Account", description: "Email, password & security", icon: Mail },
  { label: "Help & Support", description: "FAQs and contact support", icon: HelpCircle },
];

const ProfilePage = () => {
  const { theme, toggleTheme } = useTheme();

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
          <div className="h-24 w-24 rounded-2xl gradient-golden flex items-center justify-center text-primary-foreground font-display font-bold text-4xl ring-4 ring-card shadow-lg">
            A
          </div>
          <h1 className="font-display text-xl font-bold text-foreground mt-3">Arjun Sharma</h1>
          <p className="text-sm text-muted-foreground">arjun@email.com</p>
          <div className="flex items-center gap-5 mt-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Star className="h-4 w-4 text-primary" /> 2,150 XP
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
      <div className="card-glass rounded-2xl p-5 flex items-center gap-5">
        <ProgressRing value={75} size={80} strokeWidth={8} label="75%" sublabel="to Lvl 9" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Level 8 → Level 9</p>
          <p className="text-xs text-muted-foreground mt-0.5">2,150 / 3,000 XP</p>
          <div className="w-full h-2.5 bg-secondary rounded-full mt-2.5 overflow-hidden">
            <motion.div
              className="h-full gradient-golden rounded-full"
              initial={{ width: 0 }}
              animate={{ width: "72%" }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="card-glass rounded-2xl p-5">
        <p className="text-sm font-semibold text-foreground mb-3">Statistics</p>
        <div className="grid grid-cols-3 gap-2.5">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
              className="text-center p-3.5 rounded-xl bg-secondary/40 hover:bg-secondary/60 transition-all"
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
            {theme === "light" ? <Sun className="h-5 w-5 text-primary" /> : <Moon className="h-5 w-5 text-primary" />}
            <div>
              <p className="text-sm font-semibold text-foreground">Appearance</p>
              <p className="text-xs text-muted-foreground">{theme === "light" ? "Light" : "Dark"} mode is active</p>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={toggleTheme}
            className={cn(
              "relative w-14 h-7 rounded-full transition-colors",
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
                i === 0 ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary/40 text-secondary-foreground hover:bg-secondary"
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
              className="w-full flex items-center gap-3 p-3.5 rounded-xl hover:bg-secondary/40 transition-all text-left group"
            >
              <div className="h-9 w-9 rounded-lg bg-secondary/60 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all flex-shrink-0">
                <item.icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
