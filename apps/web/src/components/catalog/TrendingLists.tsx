import { ArrowRight } from 'lucide-react';
import { PremiumCourseCard } from './PremiumCourseCard';

type Column = { id: string; title: string };

type Props = {
  columns: Column[];
  courses: any[];
  onCourseClick: (id: string) => void;
};

export function TrendingLists({ columns, courses, onCourseClick }: Props) {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {columns.map((col, colIdx) => {
        const slice = courses.slice(colIdx * 5, colIdx * 5 + 5);
        return (
          <div key={col.id} className="rounded-xl border border-border/60 bg-card/50 p-4">
            <h3 className="font-display text-card-title font-bold flex items-center justify-between mb-3 group cursor-default">
              {col.title}
              <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </h3>
            <div className="space-y-2">
              {slice.map((course, i) => (
                <PremiumCourseCard
                  key={course.id}
                  course={course}
                  index={i}
                  variant="horizontal"
                  onClick={() => onCourseClick(course.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
