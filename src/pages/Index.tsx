import { StatCard } from "@/components/StatCard";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import { HeatmapChart } from "@/components/HeatmapChart";
import { ProgressRing } from "@/components/ProgressRing";
import {
  Flame, Zap, Trophy, BookOpen, Eye, Bot, Map,
  Calendar, ChevronRight, Star, TrendingUp, ArrowUpRight, Target
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, LineChart, Line, Tooltip, Area, AreaChart
} from "recharts";
import { Link } from "react-router-dom";

const weeklyData = [
  { day: "S", solved: 3 },
  { day: "M", solved: 8 },
  { day: "T", solved: 12 },
  { day: "W", solved: 5, highlight: true },
  { day: "T", solved: 15 },
  { day: "F", solved: 10 },
  { day: "S", solved: 18 },
];

const pieData = [
  { name: "Easy", value: 85, color: "hsl(152,60%,45%)" },
  { name: "Medium", value: 72, color: "hsl(38,92%,50%)" },
  { name: "Hard", value: 30, color: "hsl(0,72%,51%)" },
];
const PIE_COLORS = ["hsl(152,60%,45%)", "hsl(38,92%,50%)", "hsl(0,72%,51%)"];

const radarData = [
  { skill: "Arrays", A: 80 },
  { skill: "Trees", A: 65 },
  { skill: "DP", A: 50 },
  { skill: "Graphs", A: 70 },
  { skill: "Strings", A: 85 },
  { skill: "Greedy", A: 60 },
];

const progressData = [
  { week: "W1", xp: 120 },
  { week: "W2", xp: 280 },
  { week: "W3", xp: 350 },
  { week: "W4", xp: 520 },
  { week: "W5", xp: 680 },
  { week: "W6", xp: 780 },
];

const quickActions = [
  { label: "Start Tasks", icon: Zap, to: "/topics", desc: "Continue learning" },
  { label: "Visualizer", icon: Eye, to: "/visualizer", desc: "Watch algorithms" },
  { label: "Ask AI", icon: Bot, to: "/ai-coach", desc: "Get instant help" },
  { label: "Roadmap", icon: Map, to: "/topics", desc: "Your learning path" },
];

const upcomingTasks = [
  { title: "Binary Search on Rotated Array", difficulty: "Medium", topic: "Arrays", time: "~25 min" },
  { title: "LCA of Binary Tree", difficulty: "Hard", topic: "Trees", time: "~40 min" },
  { title: "Coin Change Problem", difficulty: "Medium", topic: "DP", time: "~30 min" },
];

const leaderboard = [
  { name: "Arjun S.", xp: 2450, rank: 1 },
  { name: "Priya M.", xp: 2280, rank: 2 },
  { name: "You", xp: 2150, rank: 3 },
  { name: "Rahul K.", xp: 1980, rank: 4 },
];

const calendarDays = [
  { day: "Mon", date: "3", active: false },
  { day: "Tue", date: "4", active: false },
  { day: "Wed", date: "5", active: false },
  { day: "Thu", date: "6", active: true },
  { day: "Fri", date: "7", active: false },
  { day: "Sat", date: "8", active: false },
  { day: "Sun", date: "9", active: false },
];

const Dashboard = () => {
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Welcome Header */}
      <div className="relative overflow-hidden rounded-3xl gradient-golden p-6 md:p-8">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-primary-foreground/10" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 md:h-20 md:w-20 rounded-2xl bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center text-primary-foreground font-display font-bold text-2xl md:text-3xl ring-4 ring-primary-foreground/20">
              A
            </div>
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-primary-foreground">
                Welcome in, Arjun
              </h1>
              <div className="flex items-center gap-4 mt-1.5">
                <span className="flex items-center gap-1.5 text-sm text-primary-foreground/80">
                  <Flame className="h-4 w-4" /> 14 Day Streak
                </span>
                <span className="flex items-center gap-1.5 text-sm text-primary-foreground/80">
                  <Trophy className="h-4 w-4" /> Rank #3
                </span>
              </div>
            </div>
          </div>
          {/* Big Stats like reference */}
          <div className="flex items-center gap-6 md:gap-10">
            <div className="text-center">
              <p className="font-display text-4xl md:text-5xl font-bold text-primary-foreground">187</p>
              <p className="text-xs text-primary-foreground/70 mt-1">Solved</p>
            </div>
            <div className="text-center">
              <p className="font-display text-4xl md:text-5xl font-bold text-primary-foreground">2,150</p>
              <p className="text-xs text-primary-foreground/70 mt-1">XP</p>
            </div>
            <div className="text-center">
              <p className="font-display text-4xl md:text-5xl font-bold text-primary-foreground">8</p>
              <p className="text-xs text-primary-foreground/70 mt-1">Level</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress + Time Tracker + Onboarding Row (like reference) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Weekly Progress Card */}
        <div className="bg-card rounded-2xl p-5 shadow-card border border-border">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-foreground">Progress</p>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="font-display text-3xl font-bold text-foreground">6.1h</span>
            <span className="text-xs text-muted-foreground">Study time this week</span>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={weeklyData} barCategoryGap="20%">
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(30,8%,50%)" }} axisLine={false} tickLine={false} />
              <Bar dataKey="solved" radius={[4, 4, 0, 0]}>
                {weeklyData.map((entry, index) => (
                  <Cell key={index} fill={index === 3 ? "hsl(38,92%,50%)" : "hsl(38,92%,50%,0.25)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pomodoro / Time Tracker */}
        <PomodoroTimer />

        {/* Difficulty Breakdown */}
        <div className="bg-card rounded-2xl p-5 shadow-card border border-border">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground">Difficulty Split</p>
            <span className="text-xs text-muted-foreground">187 Total</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <ResponsiveContainer width={100} height={100}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={45} dataKey="value" stroke="none" strokeWidth={0}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2.5 flex-1">
              {pieData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="text-sm font-bold font-display text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Progress bars */}
          <div className="mt-4 space-y-2">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-12">{item.name}</span>
                <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(item.value / 187) * 100}%`, backgroundColor: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickActions.map((action) => (
          <Link
            key={action.label}
            to={action.to}
            className="group bg-card rounded-2xl p-4 shadow-card border border-border hover:shadow-card-hover hover:border-primary/20 transition-all duration-300 flex items-start gap-3"
          >
            <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors flex-shrink-0">
              <action.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{action.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{action.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Heatmap + Radar + XP Growth */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <HeatmapChart />
        <div className="bg-card rounded-2xl p-5 shadow-card border border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Skill Radar</p>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart cx="50%" cy="50%" outerRadius={70} data={radarData}>
              <PolarGrid stroke="hsl(36,20%,88%)" />
              <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10, fill: "hsl(30,8%,50%)" }} />
              <PolarRadiusAxis tick={false} axisLine={false} />
              <Radar dataKey="A" stroke="hsl(38,92%,50%)" fill="hsl(38,92%,50%)" fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card rounded-2xl p-5 shadow-card border border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">XP Growth</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={progressData}>
              <defs>
                <linearGradient id="xpGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(38,92%,50%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(38,92%,50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: "hsl(30,8%,50%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(30,8%,50%)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "hsl(0,0%,100%)", border: "1px solid hsl(36,20%,88%)", borderRadius: "12px", fontSize: 12 }} />
              <Area type="monotone" dataKey="xp" stroke="hsl(38,92%,50%)" strokeWidth={2} fill="url(#xpGradient)" dot={{ fill: "hsl(38,92%,50%)", r: 3, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Calendar + AI Roadmap + Leaderboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Calendar Strip */}
        <div className="bg-card rounded-2xl p-5 shadow-card border border-border">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-foreground">
              <Calendar className="h-4 w-4 inline mr-1.5 text-primary" />February 2026
            </p>
            <span className="text-xs text-muted-foreground">This Week</span>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((d) => (
              <div
                key={d.day + d.date}
                className={`text-center p-2.5 rounded-xl transition-all cursor-pointer ${
                  d.active
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-secondary text-secondary-foreground hover:bg-muted"
                }`}
              >
                <p className="text-[10px] font-medium opacity-70">{d.day}</p>
                <p className="text-base font-bold font-display mt-0.5">{d.date}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI Roadmap */}
        <div className="bg-card rounded-2xl p-5 shadow-card border border-border">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-foreground">
              <Target className="h-4 w-4 inline mr-1.5 text-primary" />AI Roadmap
            </p>
            <span className="text-xs font-medium text-primary">3 tasks</span>
          </div>
          <div className="space-y-2.5">
            {upcomingTasks.map((task, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/60 hover:bg-secondary transition-colors">
                <div className="h-9 w-9 rounded-xl gradient-golden flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0 shadow-sm">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{task.topic}</span>
                    <span className="text-[10px] text-muted-foreground">• {task.time}</span>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded-lg font-medium ${
                  task.difficulty === "Hard" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                }`}>
                  {task.difficulty}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-card rounded-2xl p-5 shadow-card border border-border">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-foreground">Leaderboard</p>
            <Link to="/referrals" className="text-xs text-primary font-medium hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {leaderboard.map((user) => (
              <div key={user.rank} className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                user.name === "You" ? "bg-primary/8 border border-primary/15" : "bg-secondary/60 hover:bg-secondary"
              }`}>
                <span className={`font-display font-bold text-base w-7 text-center ${
                  user.rank === 1 ? "text-primary" : user.rank === 2 ? "text-muted-foreground" : user.rank === 3 ? "text-accent" : "text-muted-foreground"
                }`}>
                  {user.rank === 1 ? "🥇" : user.rank === 2 ? "🥈" : user.rank === 3 ? "🥉" : `#${user.rank}`}
                </span>
                <span className={`flex-1 text-sm font-medium ${user.name === "You" ? "text-primary" : "text-foreground"}`}>{user.name}</span>
                <span className="text-xs font-semibold text-muted-foreground">{user.xp.toLocaleString()} XP</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Referral Summary */}
      <div className="relative overflow-hidden bg-card rounded-2xl shadow-card border border-border p-6">
        <div className="absolute top-0 right-0 w-1/3 h-full gradient-golden opacity-10 rounded-l-full" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="font-display font-bold text-lg text-foreground">Invite Friends & Earn Rewards</p>
            <p className="text-sm text-muted-foreground mt-1">Share your referral link and earn ₹100 per active referral!</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="font-display text-2xl font-bold text-foreground">5</p>
              <p className="text-[10px] text-muted-foreground">Referred</p>
            </div>
            <div className="text-center">
              <p className="font-display text-2xl font-bold text-primary">₹350</p>
              <p className="text-[10px] text-muted-foreground">Earned</p>
            </div>
            <Link
              to="/referrals"
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
            >
              View Details <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
