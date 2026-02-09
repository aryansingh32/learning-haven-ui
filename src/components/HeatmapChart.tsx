import { cn } from "@/lib/utils";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weeks = 12;

// Generate random heatmap data
const generateData = () => {
  return Array.from({ length: weeks }, () =>
    Array.from({ length: 7 }, () => Math.floor(Math.random() * 5))
  );
};

const data = generateData();

const intensityClasses = [
  "bg-secondary",
  "bg-primary/20",
  "bg-primary/40",
  "bg-primary/60",
  "bg-primary/80",
];

export function HeatmapChart({ className }: { className?: string }) {
  return (
    <div className={cn("bg-card rounded-2xl p-5 shadow-card border border-border", className)}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Activity Heatmap</p>
      <div className="flex gap-1">
        <div className="flex flex-col gap-1 mr-1 text-[9px] text-muted-foreground">
          {days.map((d) => (
            <div key={d} className="h-3 flex items-center">{d}</div>
          ))}
        </div>
        {data.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((val, di) => (
              <div
                key={di}
                className={cn("h-3 w-3 rounded-sm", intensityClasses[val])}
                title={`${val} problems`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
