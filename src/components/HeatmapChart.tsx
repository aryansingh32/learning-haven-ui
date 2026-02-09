import { cn } from "@/lib/utils";

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
  "bg-primary/50",
  "bg-primary/75",
];

export function HeatmapChart({ className }: { className?: string }) {
  return (
    <div className={cn("bg-card rounded-2xl p-5 shadow-card border border-border", className)}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Activity Heatmap</p>
        <span className="text-[10px] text-muted-foreground">Last {weeks} weeks</span>
      </div>
      <div className="flex gap-[3px]">
        <div className="flex flex-col gap-[3px] mr-1 text-[8px] text-muted-foreground">
          {days.map((d) => (
            <div key={d} className="h-[14px] flex items-center leading-none">{d}</div>
          ))}
        </div>
        {data.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((val, di) => (
              <div
                key={di}
                className={cn("h-[14px] w-[14px] rounded-[3px] transition-colors", intensityClasses[val])}
                title={`${val} problems`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-3 justify-end">
        <span className="text-[9px] text-muted-foreground">Less</span>
        {intensityClasses.map((cls, i) => (
          <div key={i} className={cn("h-[10px] w-[10px] rounded-[2px]", cls)} />
        ))}
        <span className="text-[9px] text-muted-foreground">More</span>
      </div>
    </div>
  );
}
