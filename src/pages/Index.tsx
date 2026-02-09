import { StatCard } from "@/components/StatCard";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import { HeatmapChart } from "@/components/HeatmapChart";
import { ProgressRing } from "@/components/ProgressRing";
import {
  Flame, Zap, Trophy, BookOpen, Eye, Bot, Map,
  Calendar, ChevronRight, Star, TrendingUp
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, LineChart, Line, Tooltip
} from "recharts";
import { Link } from "react-router-dom";

const weeklyData = [
  { day: "Mon", solved: 8 },
  { day: "Tue", solved: 12 },
  { day: "Wed", solved: 5 },
  { day: "Thu", solved: 15 },
  { day: "Fri", solved: 10 },
  { day: "Sat", solved: 18 },
  { day: "Sun", solved: 7 },
];

const pieData = [
  { name: "Easy", value: 45 },
  { name: "Medium", value: 35 },
  { name: "Hard", value: 20 },
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
  { label: "Start Today's Tasks", icon: Zap, to: "/topics", color: "bg-primary text-primary-foreground" },
  { label: "Open Visualizer", icon: Eye, to: "/visualizer", color: "bg-info text-info-foreground" },
  { label: "Ask AI", icon: Bot, to: "/ai-coach", color: "bg-success text-primary-foreground" },
  { label: "Roadmap", icon: Map, to: "/topics", color: "bg-accent text-accent-foreground" },
];

const upcomingTasks = [
  { title: "Binary Search on Rotated Array", difficulty: "Medium", topic: "Arrays" },
  { title: "LCA of Binary Tree", difficulty: "Hard", topic: "Trees" },
  { title: "Coin Change Problem", difficulty: "Medium", topic: "DP" },
];

const leaderboard = [
  { name: "Arjun S.", xp: 2450, rank: 1 },
  { name: "Priya M.", xp: 2280, rank: 2 },
  { name: "You", xp: 2150, rank: 3 },
  { name: "Rahul K.", xp: 1980, rank: 4 },
];

const calendarDays = ["Mon 3", "Tue 4", "Wed 5", "Thu 6", "Fri 7", "Sat 8", "Sun 9"];

const Dashboard = () => {
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Welcome Header */}
      <div className="bg-card rounded-2xl p-6 shadow-card border border-border">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full gradient-golden flex items-center justify-center text-primary-foreground font-display font-bold text-xl">
            A
          </div>
          <div className="flex-1">
            <h1 className="font-display text-xl md:text-2xl font-bold text-foreground">
              Welcome back, Arjun! 👋
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Star className="h-4 w-4 text-primary" /> 2,150 XP
              </span>
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Flame className="h-4 w-4 text-destructive" /> 14 Day Streak
              </span>
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Trophy className="h-4 w-4 text-primary" /> Rank #3
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickActions.map((action) => (
          <Link
            key={action.label}
            to={action.to}
            className={`${action.color} rounded-2xl p-4 shadow-card hover:shadow-card-hover transition-all duration-300 flex flex-col items-center gap-2 text-center`}
          >
            <action.icon className="h-6 w-6" />
            <span className="text-xs font-medium">{action.label}</span>
          </Link>
        ))}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Problems Solved" value={187} subtitle="+12 this week" icon={<BookOpen className="h-5 w-5" />} />
        <StatCard title="Current Streak" value="14 Days" subtitle="Personal best!" icon={<Flame className="h-5 w-5" />} />
        <StatCard title="XP Earned" value="2,150" subtitle="Level 8" icon={<Star className="h-5 w-5" />} />
        <StatCard title="Rank" value="#3" subtitle="Top 5%" icon={<Trophy className="h-5 w-5" />} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Weekly Bar Chart */}
        <div className="bg-card rounded-2xl p-5 shadow-card border border-border col-span-1 md:col-span-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Weekly Progress</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyData}>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(30,8%,50%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(30,8%,50%)" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(0,0%,100%)",
                  border: "1px solid hsl(36,20%,88%)",
                  borderRadius: "12px",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="solved" fill="hsl(38,92%,50%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Difficulty Pie */}
        <div className="bg-card rounded-2xl p-5 shadow-card border border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">By Difficulty</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" stroke="none">
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" />Easy</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" />Medium</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive" />Hard</span>
          </div>
        </div>
      </div>

      {/* Pomodoro + Heatmap + Radar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PomodoroTimer />
        <HeatmapChart />
        <div className="bg-card rounded-2xl p-5 shadow-card border border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Skill Radar</p>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart cx="50%" cy="50%" outerRadius={70} data={radarData}>
              <PolarGrid stroke="hsl(36,20%,88%)" />
              <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10, fill: "hsl(30,8%,50%)" }} />
              <PolarRadiusAxis tick={false} axisLine={false} />
              <Radar dataKey="A" stroke="hsl(38,92%,50%)" fill="hsl(38,92%,50%)" fillOpacity={0.3} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* XP Progress + Calendar + AI Roadmap */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* XP Line Chart */}
        <div className="bg-card rounded-2xl p-5 shadow-card border border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">XP Growth</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={progressData}>
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: "hsl(30,8%,50%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(30,8%,50%)" }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="xp" stroke="hsl(38,92%,50%)" strokeWidth={2} dot={{ fill: "hsl(38,92%,50%)", r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Calendar Strip */}
        <div className="bg-card rounded-2xl p-5 shadow-card border border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            <Calendar className="h-3 w-3 inline mr-1" />This Week
          </p>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, i) => (
              <div
                key={day}
                className={`text-center p-2 rounded-xl text-xs font-medium ${
                  i === 3 ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}
              >
                {day.split(" ")[0]}<br/>
                <span className="text-sm font-bold">{day.split(" ")[1]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Roadmap */}
        <div className="bg-card rounded-2xl p-5 shadow-card border border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            <TrendingUp className="h-3 w-3 inline mr-1" />AI Roadmap
          </p>
          <div className="space-y-3">
            {upcomingTasks.map((task, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-xl bg-secondary">
                <div className="h-8 w-8 rounded-lg gradient-golden flex items-center justify-center text-primary-foreground text-xs font-bold">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                  <p className="text-[10px] text-muted-foreground">{task.topic}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  task.difficulty === "Hard" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                }`}>
                  {task.difficulty}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Leaderboard + Referral */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl p-5 shadow-card border border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Leaderboard</p>
          <div className="space-y-2">
            {leaderboard.map((user) => (
              <div key={user.rank} className={`flex items-center gap-3 p-3 rounded-xl ${
                user.name === "You" ? "bg-primary/10 border border-primary/20" : "bg-secondary"
              }`}>
                <span className={`font-display font-bold text-lg w-8 text-center ${
                  user.rank === 1 ? "text-primary" : "text-muted-foreground"
                }`}>
                  #{user.rank}
                </span>
                <span className="flex-1 text-sm font-medium text-foreground">{user.name}</span>
                <span className="text-sm text-muted-foreground">{user.xp} XP</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl p-5 shadow-card border border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Referral Summary</p>
          <div className="relative overflow-hidden rounded-xl gradient-golden p-5 text-primary-foreground">
            <p className="font-display font-bold text-lg">Invite & Earn</p>
            <p className="text-sm opacity-90 mt-1">Share your referral link and earn rewards!</p>
            <Link
              to="/referrals"
              className="inline-flex items-center gap-1 mt-3 text-sm font-medium bg-card/20 px-4 py-2 rounded-full hover:bg-card/30 transition-colors"
            >
              View Details <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="text-center p-3 bg-secondary rounded-xl">
              <p className="font-display font-bold text-lg text-foreground">5</p>
              <p className="text-[10px] text-muted-foreground">Referred</p>
            </div>
            <div className="text-center p-3 bg-secondary rounded-xl">
              <p className="font-display font-bold text-lg text-foreground">₹350</p>
              <p className="text-[10px] text-muted-foreground">Earned</p>
            </div>
            <div className="text-center p-3 bg-secondary rounded-xl">
              <p className="font-display font-bold text-lg text-foreground">Silver</p>
              <p className="text-[10px] text-muted-foreground">Tier</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
