import { cn } from "@/lib/utils";
import { useState } from "react";
import { motion } from "framer-motion";
import { useApiQuery } from "@/hooks/useApi";
import { Skeleton } from "./ui/skeleton";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weeks = 16;

const intensityClasses = [
  "bg-secondary",
  "bg-primary/15",
  "bg-primary/30",
  "bg-primary/55",
  "bg-primary/80",
];

export function HeatmapChart({ className }: { className?: string }) {
  const [hoveredCell, setHoveredCell] = useState<{ week: number; day: number } | null>(null);

  const { data, isLoading } = useApiQuery<number[][]>(
    ['heatmap-activity'],
    '/users/analytics/activity'
  );

  if (isLoading) {
    return (
      <div className={cn("card-glass rounded-2xl p-5 card-hover", className)}>
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex gap-[3px] mt-2">
          {Array.from({ length: weeks }).map((_, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {Array.from({ length: 7 }).map((_, j) => (
                <Skeleton key={j} className="h-[14px] w-[14px] rounded-[3px]" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const heatmapData = data || Array.from({ length: weeks }, () => Array.from({ length: 7 }, () => 0));

  return (
    <div className={cn("card-glass rounded-2xl p-5 card-hover", className)}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Activity Heatmap</p>
        <span className="text-[10px] text-muted-foreground">Last {weeks} weeks</span>
      </div>
      <div className="flex gap-[3px]">
        <div className="flex flex-col gap-[3px] mr-1.5 text-[8px] text-muted-foreground">
          {days.map((d) => (
            <div key={d} className="h-[14px] flex items-center leading-none">{d}</div>
          ))}
        </div>
        {heatmapData.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((val, di) => (
              <div
                key={di}
                className="relative"
                onMouseEnter={() => setHoveredCell({ week: wi, day: di })}
                onMouseLeave={() => setHoveredCell(null)}
              >
                <motion.div
                  className={cn(
                    "h-[14px] w-[14px] rounded-[3px] cursor-pointer transition-colors duration-200",
                    intensityClasses[Math.min(val, 4)]
                  )}
                  whileHover={{ scale: 1.4 }}
                  transition={{ duration: 0.15 }}
                />
                {hoveredCell?.week === wi && hoveredCell?.day === di && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-[9px] px-2 py-1 rounded-md whitespace-nowrap z-10 pointer-events-none shadow-lg">
                    {val} problems • {days[di]}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-4 justify-end">
        <span className="text-[9px] text-muted-foreground">Less</span>
        {intensityClasses.map((cls, i) => (
          <div key={i} className={cn("h-[10px] w-[10px] rounded-[2px]", cls)} />
        ))}
        <span className="text-[9px] text-muted-foreground">More</span>
      </div>
    </div>
  );
}
