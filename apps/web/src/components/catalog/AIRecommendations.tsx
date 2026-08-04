import { Sparkles } from 'lucide-react';
import { PremiumCourseCard } from './PremiumCourseCard';
import { type CatalogCourse } from './catalog-utils';
import { useNavigate } from 'react-router-dom';

type AIRecommendationsProps = {
  recommendations: CatalogCourse[];
};

export function AIRecommendations({ recommendations }: AIRecommendationsProps) {
  const navigate = useNavigate();

  if (!recommendations || recommendations.length === 0) return null;

  return (
    <section className="space-y-6 animate-fade-slide-up mt-12 mb-12">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-section-title font-bold text-foreground">AI Recommendations</h2>
          <p className="text-meta text-muted-foreground mt-0.5">Personalized suggestions based on your recent learning paths.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {recommendations.map((course, i) => (
          <PremiumCourseCard
            key={course.id}
            course={course}
            index={i}
            onClick={() => navigate(`/courses/${course.slug}`)}
          />
        ))}
      </div>
    </section>
  );
}
