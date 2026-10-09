import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, ChevronRight } from 'lucide-react';
import { useCampusMe } from '@/hooks/useCampus';
import { fetchMyDrives } from '@/services/campus.service';

/** "Placement drives" strip on My College; hidden when there are none. */
export function DrivesTeaser() {
  const { isStudent } = useCampusMe();
  const drives = useQuery({ queryKey: ['my-drives'], queryFn: fetchMyDrives, enabled: isStudent, retry: false });
  const list = drives.data ?? [];
  if (list.length === 0) return null;
  const open = list.filter((d) => d.status === 'open' && d.canApply && !d.myStatus);
  const active = list.filter((d) => d.myStatus && d.myStatus !== 'withdrawn');
  return (
    <Link to="/college/drives" className="card-glass flex items-center gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5 transition-colors hover:border-primary/40">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Briefcase className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1">
        <p className="font-display font-bold text-foreground">Placement drives</p>
        <p className="text-sm text-muted-foreground">
          {open.length ? `${open.length} open for you: ${open.slice(0, 3).map((d) => d.company).join(', ')}` : 'No new drives to apply to'}
          {active.length ? ` · ${active.length} application${active.length === 1 ? '' : 's'}` : ''}
        </p>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </Link>
  );
}
