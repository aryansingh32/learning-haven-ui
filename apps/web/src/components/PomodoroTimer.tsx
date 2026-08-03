import { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export function PomodoroTimer({ className }: { className?: string }) {
  const [time, setTime] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (running && time > 0) {
      intervalRef.current = setInterval(() => setTime((t) => t - 1), 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, time]);

  const mins = Math.floor(time / 60).toString().padStart(2, "0");
  const secs = (time % 60).toString().padStart(2, "0");
  const progress = 1 - time / (25 * 60);
  const radius = 58;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - progress * circumference;

  return (
    <div className={cn("card-glass rounded-2xl p-6 flex flex-col items-center card-hover", className)}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Pomodoro Timer</p>
      <div className="relative w-36 h-36">
        {/* Glow ring when active */}
        {running && (
          <motion.div
            className="absolute inset-0 rounded-full"
            animate={{ boxShadow: [
              "0 0 20px -5px hsl(38 92% 50% / 0.2)",
              "0 0 40px -5px hsl(38 92% 50% / 0.4)",
              "0 0 20px -5px hsl(38 92% 50% / 0.2)",
            ]}}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
        <svg width={144} height={144} className="-rotate-90">
          <defs>
            <linearGradient id="timerGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="hsl(38 92% 50%)" />
              <stop offset="100%" stopColor="hsl(28 90% 55%)" />
            </linearGradient>
          </defs>
          <circle cx={72} cy={72} r={radius} fill="none" stroke="hsl(var(--secondary))" strokeWidth={8} />
          <motion.circle
            cx={72} cy={72} r={radius} fill="none"
            stroke="url(#timerGrad)" strokeWidth={8}
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round"
            initial={false}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-bold text-foreground tabular-nums tracking-tight">{mins}:{secs}</span>
          <span className="text-[10px] text-muted-foreground mt-0.5">{running ? "Focus" : "Ready"}</span>
        </div>
      </div>
      <div className="flex gap-3 mt-5">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setRunning(!running)}
          className={cn(
            "h-11 w-11 rounded-full flex items-center justify-center transition-all shadow-lg btn-ripple",
            running
              ? "bg-destructive/90 text-destructive-foreground hover:bg-destructive"
              : "gradient-golden text-primary-foreground hover:shadow-xl"
          )}
        >
          {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => { setRunning(false); setTime(25 * 60); }}
          className="h-11 w-11 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center hover:bg-muted transition-all"
        >
          <RotateCcw className="h-4 w-4" />
        </motion.button>
      </div>
    </div>
  );
}
