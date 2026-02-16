import { PomodoroTimer } from "@/components/PomodoroTimer";
import { HeatmapChart } from "@/components/HeatmapChart";
import {
  Flame, Zap, Trophy, Eye, Bot, Map,
  Calendar, ChevronRight, ArrowUpRight, Target, Sparkles,
  TrendingUp, Clock, BarChart3, AlertCircle
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Tooltip, Area, AreaChart
} from "recharts";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { Easing } from "framer-motion";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";
import { useApiQuery } from "@/hooks/useApi";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const PIE_COLORS = ["hsl(152,60%,45%)", "hsl(38,92%,50%)", "hsl(0,72%,51%)"];

const quickActions = [
  { label: "Start Tasks", icon: Zap, to: "/topics", desc: "Continue learning" },
  { label: "Visualizer", icon: Eye, to: "/visualizer", desc: "Watch algorithms" },
  { label: "Ask AI", icon: Bot, to: "/ai-coach", desc: "Get instant help" },
  { label: "Roadmap", icon: Map, to: "/topics", desc: "Your learning path" },
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

const easeOut: Easing = [0.33, 1, 0.68, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.5, ease: easeOut }
  }),
};

const Dashboard = () => {
  // 1. Fetch User Profile
  const { data: profile, isLoading: profileLoading } = useApiQuery<any>(
    ['user-profile'],
    '/users/me'
  );

  const { data: topicProgress } = useApiQuery<any[]>(
    ['topic-progress'],
    '/users/me/progress'
  );

  // 2. Fetch User Stats
  const { data: stats, isLoading: statsLoading } = useApiQuery<any>(
    ['user-stats'],
    '/users/me/stats'
  );

  // 3. Fetch Weekly Stats
  const { data: weeklyStats, isLoading: weeklyLoading } = useApiQuery<any>(
    ['weekly-stats'],
    '/users/analytics/weekly'
  );

  // 4. Fetch Radar Chart Data
  const { data: radarData, isLoading: radarLoading } = useApiQuery<any[]>(
    ['radar-stats'],
    '/users/analytics/radar'
  );

  // 5. Fetch Leaderboard
  const { data: leaderboard, isLoading: leaderboardLoading } = useApiQuery<any[]>(
    ['leaderboard'],
    '/submissions/leaderboard'
  );

  // 6. Fetch Tasks
  const { data: tasks, isLoading: tasksLoading } = useApiQuery<any[]>(
    ['upcoming-tasks'],
    '/tasks'
  );

  // Animated counters with API data
  const solvedCount = useAnimatedCounter(0, stats?.total_solved || 0, 800);
  const consistencyCount = useAnimatedCounter(0, stats?.consistency || 87, 800); // Need backend consistency field?
  const streakCount = useAnimatedCounter(0, stats?.streak || 0, 800);
  const avgHours = useAnimatedCounter(0, stats?.avg_study_time || 34, 800); // 3.4h

  const isLoading = profileLoading || statsLoading || weeklyLoading;

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-64 w-full rounded-3xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  const pieData = [
    { name: "Easy", value: stats?.easy_solved || 0, color: "hsl(152,60%,45%)" },
    { name: "Medium", value: stats?.medium_solved || 0, color: "hsl(38,92%,50%)" },
    { name: "Hard", value: stats?.hard_solved || 0, color: "hsl(0,72%,51%)" },
  ];

  // Map radar data to frontend format
  const mappedRadarData = radarData?.map(r => ({
    skill: r.topic,
    A: r.mastery
  })) || [];

  // Calculate weakest topic
  const weakestTopic = topicProgress?.length > 0
    ? [...topicProgress].sort((a, b) => a.progress - b.progress)[0]
    : null;

  const totalAttempted = (stats?.total_solved || 0) + (stats?.total_tried || 0) + (stats?.total_revision || 0);

  // Map tasks to frontend format
  const upcomingTasks = (tasks?.tasks || []).slice(0, 3).map((task: any) => ({
    title: task.title,
    difficulty: task.priority === 'high' ? 'Hard' : 'Medium',
    topic: task.category || 'General',
    time: "~25 min",
    progress: task.status === 'completed' ? 100 : task.status === 'in_progress' ? 50 : 0
  })) || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Hero Stats Row — Big Numbers */}
      <motion.div
        variants={fadeUp} initial="hidden" animate="show" custom={0}
        className="relative overflow-hidden rounded-3xl gradient-golden p-6 md:p-8 shine-sweep"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary-foreground/15" />
        <div className="absolute top-4 right-6 opacity-10">
          <Sparkles className="h-36 w-36 text-primary-foreground" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-14 w-14 md:h-16 md:w-16 rounded-2xl bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center text-primary-foreground font-display font-bold text-2xl md:text-3xl ring-4 ring-primary-foreground/20 overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
              ) : (
                profile?.full_name?.charAt(0) || 'U'
              )}
            </div>
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-primary-foreground">
                Welcome back, {profile?.full_name?.split(' ')[0] || 'User'}
              </h1>
              <div className="flex items-center gap-4 mt-1">
                <span className="flex items-center gap-1.5 text-sm text-primary-foreground/80">
                  <Flame className="h-4 w-4" /> {stats?.streak || 0} Day Streak
                </span>
                <span className="flex items-center gap-1.5 text-sm text-primary-foreground/80">
                  <Trophy className="h-4 w-4" /> Rank #{stats?.rank || '-'}
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {[
              { val: solvedCount.toLocaleString(), label: `Problems Solved (of ${totalAttempted} tried)`, icon: BarChart3, growth: `${weeklyStats?.percentChange >= 0 ? '+' : ''}${weeklyStats?.percentChange || 0}% this week` },
              { val: `${consistencyCount}%`, label: "Consistency", icon: Target, growth: "+5% this week" },
              { val: streakCount.toString(), label: "Day Streak", icon: Flame, growth: stats?.streak >= stats?.longest_streak ? "Personal best!" : "Keep going!" },
              { val: `${(avgHours / 10).toFixed(1)}h`, label: "Avg Study Time", icon: Clock, growth: "+0.3h vs last week" },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
                className="bg-primary-foreground/10 backdrop-blur-sm rounded-2xl p-4 border border-primary-foreground/10"
              >
                <s.icon className="h-5 w-5 text-primary-foreground/70 mb-2" />
                <p className="font-display text-3xl md:text-4xl font-bold text-primary-foreground tabular-nums">{s.val}</p>
                <p className="text-[11px] text-primary-foreground/60 mt-0.5">{s.label}</p>
                <p className="text-[10px] text-primary-foreground/50 mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> {s.growth}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* XP Level Bar */}
      <motion.div
        variants={fadeUp} initial="hidden" animate="show" custom={1}
        className="card-glass rounded-2xl p-4 flex items-center gap-4"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl gradient-golden flex items-center justify-center text-primary-foreground font-display font-bold text-sm shadow-md">{profile?.level || 1}</div>
          <div>
            <p className="text-xs font-semibold text-foreground">Level {profile?.level || 1}</p>
            <p className="text-[10px] text-muted-foreground">{profile?.xp?.toLocaleString() || 0} / {(profile?.xp + profile?.xp_to_next_level)?.toLocaleString() || 3000} XP</p>
          </div>
        </div>
        <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full gradient-golden rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${profile?.level_progress || 0}%` }}
            transition={{ duration: 1.4, ease: "easeOut", delay: 0.5 }}
          />
        </div>
        <span className="text-xs font-bold text-primary tabular-nums">{profile?.level_progress || 0}%</span>
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={2}
          className="card-glass rounded-2xl p-5 card-hover">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-foreground">Weekly Progress</p>
            <span className={cn(
              "text-[10px] px-2 py-0.5 rounded-full font-semibold",
              weeklyStats?.percentChange >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
            )}>
              {weeklyStats?.percentChange >= 0 ? '+' : ''}{weeklyStats?.percentChange || 0}%
            </span>
          </div>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="font-display text-3xl font-bold text-foreground">{(weeklyStats?.thisWeek || 0).toFixed(1)}h</span>
            <span className="text-xs text-muted-foreground">this week</span>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            {/* Note: In a real app, this should fetch daily data specifically */}
            <BarChart data={[]} barCategoryGap="20%">
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "hsl(var(--secondary))", radius: 8 }}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: 12 }}
              />
              <Bar dataKey="solved" radius={[6, 6, 0, 0]} animationDuration={1200} fill="hsl(38,92%,50%,0.18)" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={2}
          className="card-glass rounded-2xl p-5 card-hover">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-foreground">Focus Area</p>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </div>
          {weakestTopic ? (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Weakest Topic</p>
              <p className="font-display text-lg font-bold text-foreground mb-2">{weakestTopic.topic}</p>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span>Mastery</span>
                  <span className="font-bold">{weakestTopic.progress}%</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-destructive"
                    initial={{ width: 0 }}
                    animate={{ width: `${weakestTopic.progress}%` }}
                    transition={{ duration: 1 }}
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Link to={`/topics?search=${weakestTopic.topic}`} className="text-[10px] px-3 py-1.5 bg-primary/10 text-primary rounded-lg font-semibold hover:bg-primary/20 transition-colors">
                  Practice Now
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground">Keep solving to find your weak spots!</p>
            </div>
          )}
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={3}>
          <PomodoroTimer />
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={4}
          className="card-glass rounded-2xl p-5 card-hover">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground">Difficulty Split</p>
            <span className="text-xs text-muted-foreground">{stats?.total_solved || 0} Total</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <ResponsiveContainer width={100} height={100}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={45} dataKey="value" stroke="none" animationDuration={1200}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: 11 }} />
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
            {pieData.map((item, i) => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-12">{item.name}</span>
                <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: item.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${stats?.total_solved > 0 ? (item.value / stats.total_solved) * 100 : 0}%` }}
                    transition={{ duration: 0.8, delay: 0.5 + i * 0.1 }}
                  />
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
              <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center text-primary group-hover:gradient-golden group-hover:text-primary-foreground transition-all duration-300 flex-shrink-0 group-hover:shadow-lg group-hover:scale-105">
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
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Skill Radar</p>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart cx="50%" cy="50%" outerRadius={70} data={mappedRadarData}>
              <PolarGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <PolarRadiusAxis tick={false} axisLine={false} />
              <Radar dataKey="A" stroke="hsl(38,92%,50%)" fill="hsl(38,92%,50%)" fillOpacity={0.15} strokeWidth={2} animationDuration={1200} />
            </RadarChart>
          </ResponsiveContainer>
        </motion.div>
        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={11}
          className="card-glass rounded-2xl p-5 card-hover">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">XP Growth</p>
          <ResponsiveContainer width="100%" height={200}>
            {/* progressData would ideally come from analytics/progress endpoint */}
            <AreaChart data={[]}>
              <defs>
                <linearGradient id="xpGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(38,92%,50%)" stopOpacity={0.35} />
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
              <Area type="monotone" dataKey="xp" stroke="hsl(38,92%,50%)" strokeWidth={2.5} fill="url(#xpGradient)" dot={{ fill: "hsl(38,92%,50%)", r: 3, strokeWidth: 0 }} animationDuration={1500} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Calendar + AI Roadmap + Leaderboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <motion.div
                key={d.day + d.date}
                whileHover={{ scale: 1.08 }}
                className={`text-center p-2.5 rounded-xl transition-all cursor-pointer relative ${d.active
                  ? "gradient-golden text-primary-foreground shadow-lg"
                  : "bg-secondary/50 text-secondary-foreground hover:bg-secondary"
                  }`}
              >
                <p className="text-[10px] font-medium opacity-70">{d.day}</p>
                <p className="text-base font-bold font-display mt-0.5">{d.date}</p>
                {d.streak && (
                  <div className="absolute -top-1 right-0.5">
                    <Flame className="h-3 w-3 text-destructive" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={13}
          className="card-glass rounded-2xl p-5 card-hover">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-foreground">
              <Target className="h-4 w-4 inline mr-1.5 text-primary" />AI Roadmap
            </p>
            <span className="text-[10px] px-2.5 py-1 rounded-full gradient-golden text-primary-foreground font-semibold">
              {upcomingTasks.length} tasks
            </span>
          </div>
          <div className="space-y-2.5">
            {upcomingTasks.length > 0 ? (
              upcomingTasks.map((task, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + i * 0.1 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-all duration-200 group cursor-pointer"
                >
                  <div className="h-9 w-9 rounded-xl gradient-golden flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <motion.div
                          className="h-full gradient-golden rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${task.progress}%` }}
                          transition={{ duration: 0.8, delay: 0.8 + i * 0.1 }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums">{task.progress}%</span>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-lg font-semibold ${task.difficulty === "Hard" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                    }`}>
                    {task.difficulty}
                  </span>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-10">
                <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                <p className="text-xs text-muted-foreground">No upcoming tasks</p>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={14}
          className="card-glass rounded-2xl p-5 card-hover">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-foreground">🏆 Leaderboard</p>
            <Link to="/referrals" className="text-xs text-primary font-medium hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {leaderboard?.map((user, i) => (
              <motion.div
                key={user.id || i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.1 }}
                whileHover={{ x: 4 }}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${user.id === profile?.id ? "card-layer-2 border border-primary/20" : "bg-secondary/30 hover:bg-secondary/50"
                  }`}
              >
                <span className="font-display font-bold text-base w-7 text-center">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </span>
                <span className={`flex-1 text-sm font-medium ${user.id === profile?.id ? "text-primary font-semibold" : "text-foreground"}`}>
                  {user.full_name || user.email}
                </span>
                <span className="text-xs font-semibold text-muted-foreground tabular-nums">{user.xp.toLocaleString()} XP</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Referral Summary */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" custom={15}
        className="relative overflow-hidden card-layer-2 rounded-2xl p-6 card-hover">
        <div className="absolute top-0 right-0 w-1/3 h-full gradient-golden opacity-10 rounded-l-full" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="font-display font-bold text-lg text-foreground">Invite Friends & Earn Rewards</p>
            <p className="text-sm text-muted-foreground mt-1">Share your referral link and earn ₹100 per active referral!</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="font-display text-2xl font-bold text-foreground">{profile?.referral_count || 0}</p>
              <p className="text-[10px] text-muted-foreground">Referred</p>
            </div>
            <div className="text-center">
              <p className="font-display text-2xl font-bold text-primary">₹{profile?.wallet_balance || 0}</p>
              <p className="text-[10px] text-muted-foreground">Earned</p>
            </div>
            <Link
              to="/referrals"
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl gradient-golden text-primary-foreground text-sm font-medium hover:opacity-90 transition-all shadow-lg hover:shadow-xl btn-ripple"
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
