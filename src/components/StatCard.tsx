import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function StatCard({ title, value, subtitle, icon, className, children }: StatCardProps) {
  return (
    <div className={cn(
      "card-glass rounded-2xl p-5 card-hover",
      className
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold font-display text-foreground mt-1.5">{value}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {icon && (
          <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center text-primary">
            {icon}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
