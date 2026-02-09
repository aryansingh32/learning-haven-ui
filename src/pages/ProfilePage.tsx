import { User, Star, Flame, Trophy, BookOpen, Code2, Settings, Globe, ChevronRight } from "lucide-react";
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
  { label: "Notifications", description: "Manage push notifications" },
  { label: "Privacy", description: "Control data sharing preferences" },
  { label: "Account", description: "Email, password & security" },
  { label: "Help & Support", description: "FAQs and contact support" },
];

const ProfilePage = () => {
  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">
      {/* Profile Header */}
      <div className="bg-card rounded-2xl shadow-card border border-border p-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-24 gradient-golden opacity-20" />
        <div className="relative z-10">
          <div className="h-20 w-20 rounded-full gradient-golden flex items-center justify-center text-primary-foreground font-display font-bold text-3xl mx-auto mb-3 ring-4 ring-card">
            A
          </div>
          <h1 className="font-display text-xl font-bold text-foreground">Arjun Sharma</h1>
          <p className="text-sm text-muted-foreground">arjun@email.com</p>
          <div className="flex items-center justify-center gap-4 mt-3 flex-wrap">
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="h-4 w-4 text-primary" /> 2,150 XP
            </span>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Flame className="h-4 w-4 text-destructive" /> 14 Day Streak
            </span>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Trophy className="h-4 w-4 text-primary" /> Level 8
            </span>
          </div>
        </div>
      </div>

      {/* XP Progress */}
      <div className="bg-card rounded-2xl shadow-card border border-border p-5 flex items-center gap-5">
        <div className="relative">
          <ProgressRing value={75} size={80} strokeWidth={8} label="75%" sublabel="to Lvl 9" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Level 8 → Level 9</p>
          <p className="text-xs text-muted-foreground mt-0.5">2,150 / 3,000 XP</p>
          <div className="w-full h-2 bg-secondary rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: "72%" }} />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="bg-card rounded-2xl shadow-card border border-border p-5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Statistics</p>
        <div className="grid grid-cols-3 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center p-3 rounded-xl bg-secondary">
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
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Preferred Language</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {languages.map((lang, i) => (
            <button
              key={lang}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                i === 0 ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"
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
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Settings</p>
        </div>
        <div className="space-y-1">
          {settingsItems.map((item) => (
            <button
              key={item.label}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-secondary transition-colors text-left"
            >
              <div>
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
