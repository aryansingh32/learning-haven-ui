import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Briefcase, CalendarClock, CheckCheck, ClipboardCheck, MessageSquareText, Settings2, Trophy, BookOpen, Megaphone, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/context/AuthContext';
import { fetchNotifications, markNotificationsRead, type AppNotification, type NotificationKind } from '@/services/campus.service';

const ICON: Record<NotificationKind, LucideIcon> = {
  test_assigned: ClipboardCheck, test_closing: CalendarClock, result_released: Trophy, feedback: MessageSquareText,
  course_assigned: BookOpen, course_due: CalendarClock, drive_announced: Briefcase, drive_update: Briefcase,
  job_alert: Briefcase, announcement: Megaphone,
  community_reply: MessageSquareText, team_request: Users, team_update: Users,
};

function ago(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

/** Bell with unread count; quietly absent when the Campus API isn't reachable. */
export function NotificationBell({ className }: { className?: string }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [isOpen, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ['notifications'], queryFn: fetchNotifications, enabled: isAuthenticated,
    refetchInterval: 60_000, retry: false, staleTime: 30_000,
  });
  const read = useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  if (!q.data) return null;
  const { unread, rows } = q.data;
  const open = (n: AppNotification) => {
    if (!n.readAt) read.mutate({ ids: [n.id] });
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <Popover open={isOpen} onOpenChange={(o) => { setOpen(o); if (o) void q.refetch(); }}>
      <PopoverTrigger asChild>
        <button className={cn('relative rounded-xl p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground', className)}
          aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5">
          <p className="text-sm font-bold text-foreground">Notifications</p>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                onClick={() => read.mutate({ all: true })}>
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
            <button className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Notification settings"
              onClick={() => { setOpen(false); navigate('/settings/notifications'); }}>
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing yet. Tests, results and placement drives from your college will show up here.</p>
        ) : (
          <ul className="max-h-96 divide-y divide-border/40 overflow-y-auto">
            {rows.map((n) => {
              const Icon = ICON[n.kind] ?? Bell;
              return (
                <li key={n.id}>
                  <button onClick={() => open(n)} className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-secondary/60', !n.readAt && 'bg-primary/5')}>
                    <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', n.readAt ? 'text-muted-foreground' : 'text-primary')} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-sm', n.readAt ? 'text-muted-foreground' : 'font-semibold text-foreground')}>{n.title}</span>
                      {n.body && <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">{n.body}</span>}
                      <span className="mt-1 block text-[11px] text-muted-foreground">{ago(n.createdAt)}</span>
                    </span>
                    {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
