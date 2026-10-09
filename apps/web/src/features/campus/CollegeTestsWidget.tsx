import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, ChevronRight, Clock, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCampusMe, useMyAssignments } from '@/hooks/useCampus';
import { assignmentStatus, sortTodo, timeUntil } from './assignmentStatus';

/** Dashboard card with the student's next college tests. Renders nothing for Forge-only learners. */
export function CollegeTestsWidget() {
  const navigate = useNavigate();
  const { isStudent, colleges } = useCampusMe();
  const { data } = useMyAssignments(isStudent);
  if (!isStudent) return null;

  const all = data ?? [];
  const todo = sortTodo(all.filter((a) => assignmentStatus(a).bucket === 'todo'));
  const upcoming = all.filter((a) => a.state === 'upcoming').sort((a, b) => +new Date(a.opensAt) - +new Date(b.opensAt));
  const items = [...todo, ...upcoming].slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-glass rounded-2xl p-5 border border-primary/20 bg-primary/5"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-display font-bold text-foreground flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-primary" /> {colleges[0]?.orgName ?? 'My College'}
        </h3>
        <Link to="/college" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
          All <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No college tests due. You're all caught up.</p>
      ) : (
        <div className="space-y-2">
          {items.map((a) => {
            const s = assignmentStatus(a);
            return (
              <button
                key={a.id}
                onClick={() => navigate(a.state === 'open' ? `/college/tests/${a.id}` : '/college')}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left border border-border/40 bg-background/60 hover:border-primary/40 transition-colors"
              >
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  a.state === 'open' ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground',
                )}>
                  {a.state === 'open' ? <Clock className="w-4 h-4" /> : <CalendarClock className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{a.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {s.action.kind === 'resume' ? 'In progress · ' : ''}
                    {a.state === 'open' ? `Closes in ${timeUntil(a.closesAt)}` : `Opens in ${timeUntil(a.opensAt)}`}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
