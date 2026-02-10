import { StatCard } from "@/components/StatCard";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import { HeatmapChart } from "@/components/HeatmapChart";
import { ProgressRing } from "@/components/ProgressRing";
import {
  Flame, Zap, Trophy, BookOpen, Eye, Bot, Map,
  Calendar, ChevronRight, Star, TrendingUp, ArrowUpRight, Target, Sparkles
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Tooltip, Area, AreaChart
} from "recharts";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

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
  { title: "Binary Search on Rotated Array", difficulty: "Medium", topic: "Arrays", time: "~25 min", progress: 60 },
  { title: "LCA of Binary Tree", difficulty: "Hard", topic: "Trees", time: "~40 min", progress: 20 },
  { title: "Coin Change Problem", difficulty: "Medium", topic: "DP", time: "~30 min", progress: 0 },
];

const leaderboard = [
  { name: "Arjun S.", xp: 2450, rank: 1 },
  { name: "Priya M.", xp: 2280, rank: 2 },
  { name: "You", xp: 2150, rank: 3 },
  { name: "Rahul K.", xp: 1980, rank: 4 },
];

const calendarDays = [
  { day: "Mon", date: "3", active: false, streak: true },
  { day: "Tue", date: "4", active: false, streak: true },
  { day: "Wed", date: "5", active: false, streak: false },
  { day: "Thu", date: "6", active: true, streak: true },
  { day: "Fri", date: "7", active: false, streak: false },
  { day: "Sat", date: "8", active: false, streak: false },
  { day: "Sun", date: "9", active: false, streak: false },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: "easeOut" }
  }),
};

const Dashboard = () => {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Welcome Header */}
      <motion.div
        variants={fadeUp} initial="hidden" animate="show" custom={0}
        className="relative overflow-hidden rounded-3xl gradient-golden p-6 md:p-8"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-primary-foreground/10" />
        <div className="absolute top-4 right-4 opacity-10">
          <Sparkles className="h-32 w-32 text-primary-foreground" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 md:h-20 md:w-20 rounded-2xl bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center text-primary-foreground font-display font-bold text-2xl md:text-3xl ring-4 ring-primary-foreground/20">
              A
            </div>
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-primary-foreground">
                Welcome back, Arjun
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
          <div className="flex items-center gap-6 md:gap-10">
            {[
              { val: "187", label: "Solved" },
              { val: "2,150", label: "XP" },
              { val: "8", label: "Level" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="font-display text-4xl md:text-5xl font-bold text-primary-foreground">{s.val}</p>
                <p className="text-xs text-primary-foreground/70 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* XP Level Bar */}
      <motion.div
        variants={fadeUp} initial="hidden" animate="show" custom={1}
        className="card-glass rounded-2xl p-4 flex items-center gap-4"
      >
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl gradient-golden flex items-center justify-center text-primary-foreground font-display font-bold text-sm shadow-sm">8</div>
          <div>
            <p className="text-xs font-semibold text-foreground">Level 8</p>
            <p className="text-[10px] text-muted-foreground">2,150 / 3,000 XP</p>
          </div>
        </div>
        <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full gradient-golden rounded-full"
            initial={{ width: 0 }}
            animate={{ width: "72%" }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
          />
        </div>
        <span className="text-xs font-semibold text-primary">72%</span>
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={2}
          className="card-glass rounded-2xl p-5 card-hover">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-foreground">Weekly Progress</p>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="font-display text-3xl font-bold text-foreground">6.1h</span>
            <span className="text-xs text-muted-foreground">this week</span>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={weeklyData} barCategoryGap="20%">
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Bar dataKey="solved" radius={[6, 6, 0, 0]}>
                {weeklyData.map((_, index) => (
                  <Cell key={index} fill={index === 3 ? "hsl(38,92%,50%)" : "hsl(38,92%,50%,0.2)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={3}>
          <PomodoroTimer />
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={4}
          className="card-glass rounded-2xl p-5 card-hover">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground">Difficulty Split</p>
            <span className="text-xs text-muted-foreground">187 Total</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <ResponsiveContainer width={100} height={100}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={45} dataKey="value" stroke="none">
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
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
        </motion.div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickActions.map((action, i) => (
          <motion.div key={action.label} variants={fadeUp} initial="hidden" animate="show" custom={5 + i}>
            <Link
              to={action.to}
              className="group card-glass rounded-2xl p-4 card-hover flex items-start gap-3 block"
            >
              <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 flex-shrink-0 group-hover:shadow-md">
                <action.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{action.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{action.desc}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Heatmap + Radar + XP Growth */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={9}>
          <HeatmapChart />
        </motion.div>
        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={10}
          className="card-glass rounded-2xl p-5 card-hover">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Skill Radar</p>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart cx="50%" cy="50%" outerRadius={70} data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <PolarRadiusAxis tick={false} axisLine={false} />
              <Radar dataKey="A" stroke="hsl(38,92%,50%)" fill="hsl(38,92%,50%)" fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </motion.div>
        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={11}
          className="card-glass rounded-2xl p-5 card-hover">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">XP Growth</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={progressData}>
              <defs>
                <linearGradient id="xpGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(38,92%,50%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(38,92%,50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                  fontSize: 12,
                  color: "hsl(var(--foreground))"
                }}
              />
              <Area type="monotone" dataKey="xp" stroke="hsl(38,92%,50%)" strokeWidth={2} fill="url(#xpGradient)" dot={{ fill: "hsl(38,92%,50%)", r: 3, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Calendar + AI Roadmap + Leaderboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Calendar Strip */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={12}
          className="card-glass rounded-2xl p-5 card-hover">
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
                className={`text-center p-2.5 rounded-xl transition-all cursor-pointer relative ${
                  d.active
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-secondary/60 text-secondary-foreground hover:bg-secondary"
                }`}
              >
                <p className="text-[10px] font-medium opacity-70">{d.day}</p>
                <p className="text-base font-bold font-display mt-0.5">{d.date}</p>
                {d.streak && (
                  <div className="absolute -top-1 right-0.5">
                    <Flame className="h-3 w-3 text-destructive" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* AI Roadmap */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={13}
          className="card-glass rounded-2xl p-5 card-hover">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-foreground">
              <Target className="h-4 w-4 inline mr-1.5 text-primary" />AI Roadmap
            </p>
            <span className="text-xs font-medium text-primary">3 tasks</span>
          </div>
          <div className="space-y-2.5">
            {upcomingTasks.map((task, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40 hover:bg-secondary/60 transition-all duration-200">
                <div className="h-9 w-9 rounded-xl gradient-golden flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0 shadow-sm">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full gradient-golden rounded-full" style={{ width: `${task.progress}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{task.progress}%</span>
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
        </motion.div>

        {/* Leaderboard */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={14}
          className="card-glass rounded-2xl p-5 card-hover">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-foreground">Leaderboard</p>
            <Link to="/referrals" className="text-xs text-primary font-medium hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {leaderboard.map((user, i) => (
              <motion.div
                key={user.rank}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                  user.name === "You" ? "bg-primary/10 border border-primary/20" : "bg-secondary/40 hover:bg-secondary/60"
                }`}
              >
                <span className="font-display font-bold text-base w-7 text-center">
                  {user.rank === 1 ? "🥇" : user.rank === 2 ? "🥈" : user.rank === 3 ? "🥉" : `#${user.rank}`}
                </span>
                <span className={`flex-1 text-sm font-medium ${user.name === "You" ? "text-primary" : "text-foreground"}`}>{user.name}</span>
                <span className="text-xs font-semibold text-muted-foreground">{user.xp.toLocaleString()} XP</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Referral Summary */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" custom={15}
        className="relative overflow-hidden card-glass rounded-2xl p-6 card-hover">
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
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all shadow-md hover:shadow-lg"
            >
              View Details <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
