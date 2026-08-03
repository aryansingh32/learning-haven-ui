import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Flame, PlayCircle, Trophy } from 'lucide-react';
import { useLearnCourse } from '@/hooks/useLearnCourse';

export function YourPathSection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { chapters, completedCount, progressPercent, activeChapter } = useLearnCourse();

  if (!user || !user.career_track) return null;

  // Derive the title based on career_track
  const titles: Record<string, string> = {
    'backend': 'Backend Developer Path',
    'frontend': 'Frontend Developer Path',
    'fullstack': 'Full-Stack Developer Path',
    'dsa': 'DSA & Interview Prep',
  };
  
  const title = titles[user.career_track] || 'Your Personalized Path';
  
  const handleStart = () => {
    if (activeChapter) {
      navigate(`/chapter/${activeChapter.id}`);
    } else if (chapters.length > 0) {
      navigate(`/chapter/${chapters[0].id}`);
    } else {
      navigate('/courses');
    }
  };

  return (
    <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent p-6 sm:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-3">
            <Trophy className="w-3.5 h-3.5" /> Recommended for You
          </div>
          <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">
            {title}
          </h2>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
            <span className="flex items-center gap-1.5">
              <div className="w-full max-w-[120px] h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
              <span className="font-medium text-foreground ml-1">{progressPercent}% complete</span>
            </span>
          </div>
          
          <div className="p-4 rounded-xl bg-background/50 border border-border/40 max-w-md">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Up Next</p>
            <p className="font-semibold text-foreground mb-3 truncate">
              {activeChapter?.title || 'Start your journey'}
            </p>
            <Button onClick={handleStart} className="w-full sm:w-auto shadow-md">
              <PlayCircle className="w-4 h-4 mr-2" />
              {completedCount > 0 ? 'Continue Learning' : 'Start First Lesson'}
            </Button>
          </div>
        </div>
        
        {/* Decorative / Goal side */}
        <div className="hidden md:flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-b from-orange-500/10 to-transparent border border-orange-500/20 w-64 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white shadow-lg mb-3">
            <Flame className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-foreground mb-1">Keep it up!</h3>
          <p className="text-xs text-muted-foreground">Complete this path to become interview-ready.</p>
        </div>
      </div>
    </section>
  );
}
