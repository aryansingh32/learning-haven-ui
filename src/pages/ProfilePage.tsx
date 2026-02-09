import { Star, Flame, Trophy, Settings, Globe, ChevronRight, Shield, Bell, HelpCircle, Mail } from "lucide-react";
import { ProgressRing } from "@/components/ProgressRing";

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
  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">
      {/* Profile Header */}
      <div className="bg-card rounded-2xl shadow-card border border-border relative overflow-hidden">
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
      </div>

      {/* XP Progress */}
      <div className="bg-card rounded-2xl shadow-card border border-border p-5 flex items-center gap-5">
        <ProgressRing value={75} size={80} strokeWidth={8} label="75%" sublabel="to Lvl 9" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Level 8 → Level 9</p>
          <p className="text-xs text-muted-foreground mt-0.5">2,150 / 3,000 XP</p>
          <div className="w-full h-2.5 bg-secondary rounded-full mt-2.5 overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: "72%" }} />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="bg-card rounded-2xl shadow-card border border-border p-5">
        <p className="text-sm font-semibold text-foreground mb-3">Statistics</p>
        <div className="grid grid-cols-3 gap-2.5">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center p-3.5 rounded-xl bg-secondary/60">
              <p className="font-display text-xl font-bold text-foreground">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Language Selector */}
      <div className="bg-card rounded-2xl shadow-card border border-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Preferred Language</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {languages.map((lang, i) => (
            <button
              key={lang}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                i === 0 ? "bg-primary text-primary-foreground shadow-sm" : "bg-secondary/60 text-secondary-foreground hover:bg-secondary"
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div className="bg-card rounded-2xl shadow-card border border-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <Settings className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Settings</p>
        </div>
        <div className="space-y-1">
          {settingsItems.map((item) => (
            <button
              key={item.label}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl hover:bg-secondary/60 transition-colors text-left group"
            >
              <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors flex-shrink-0">
                <item.icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
