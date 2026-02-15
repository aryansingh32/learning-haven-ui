import { cn } from "@/lib/utils";
import { useState } from "react";
import { motion } from "framer-motion";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weeks = 16;

const generateData = () => {
  return Array.from({ length: weeks }, () =>
    Array.from({ length: 7 }, () => Math.floor(Math.random() * 5))
  );
};

const data = generateData();

const intensityClasses = [
  "bg-secondary",
  "bg-primary/15",
  "bg-primary/30",
  "bg-primary/55",
  "bg-primary/80",
];

export function HeatmapChart({ className }: { className?: string }) {
  const [hoveredCell, setHoveredCell] = useState<{week: number; day: number} | null>(null);

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
        {data.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((val, di) => (
              <div
                key={di}
                className="relative"
                onMouseEnter={() => setHoveredCell({week: wi, day: di})}
                onMouseLeave={() => setHoveredCell(null)}
              >
                <motion.div
                  className={cn(
                    "h-[14px] w-[14px] rounded-[3px] cursor-pointer transition-colors duration-200",
                    intensityClasses[val]
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
