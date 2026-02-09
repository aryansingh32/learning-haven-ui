import { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const radius = 54;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - progress * circumference;

  return (
    <div className={cn("bg-card rounded-2xl p-5 shadow-card border border-border flex flex-col items-center", className)}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Pomodoro Timer</p>
      <div className="relative w-32 h-32">
        <svg width={128} height={128} className="-rotate-90">
          <circle cx={64} cy={64} r={radius} fill="none" stroke="hsl(var(--secondary))" strokeWidth={8} />
          <circle
            cx={64} cy={64} r={radius} fill="none"
            stroke="hsl(var(--primary))" strokeWidth={8}
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-2xl font-bold text-foreground">{mins}:{secs}</span>
        </div>
      </div>
      <div className="flex gap-3 mt-4">
        <button
          onClick={() => setRunning(!running)}
          className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
        >
          {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </button>
        <button
          onClick={() => { setRunning(false); setTime(25 * 60); }}
          className="h-10 w-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center hover:bg-muted transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
