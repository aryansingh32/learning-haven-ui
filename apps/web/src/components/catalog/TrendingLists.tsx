import { ArrowRight } from 'lucide-react';
import { PremiumCourseCard } from './PremiumCourseCard';

type Column = { id: string; title: string };

type Props = {
  columns: Column[];
  courses: any[];
  onCourseClick: (id: string) => void;
  enrollments?: any[];
};

export function TrendingLists({ columns, courses, onCourseClick, enrollments = [] }: Props) {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {columns.map((col, colIdx) => {
        const slice = courses.filter((_, i) => i % columns.length === colIdx).slice(0, 5);
        if (slice.length === 0) return null;
        return (
          <div key={col.id} className="rounded-xl border border-border/60 bg-card/50 p-4">
            <h3 className="font-display text-card-title font-bold mb-3 cursor-default">
              {col.title}
            </h3>
            <div className="space-y-2">
              {slice.map((course, i) => (
                <PremiumCourseCard
                  key={course.id}
                  course={course}
                  index={i}
                  variant="horizontal"
                  onClick={() => onCourseClick(course.id)}
                  isEnrolled={enrollments.some((e: any) => e.course_id === course.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
