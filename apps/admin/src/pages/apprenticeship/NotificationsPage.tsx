import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apprenticeshipApi } from '../../services/apprenticeship.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const NotificationsPage = () => {
  const [target, setTarget] = useState('all');
  const [channel, setChannel] = useState('in_app');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const broadcastMutation = useMutation({
    mutationFn: () => apprenticeshipApi.broadcastNotification({
      target,
      channel,
      subject,
      message,
    }),
    onSuccess: () => {
      toast.success('Notification queued');
      setSubject('');
      setMessage('');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to send notification'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Notifications</h2>
        <p className="text-muted-foreground">Send apprenticeship nudges, cohort updates, and direct student messages.</p>
      </div>

      <Card className="max-w-3xl border-0 shadow-md">
        <CardHeader><CardTitle>Broadcast</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue placeholder="Target" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All enrolled students</SelectItem>
                <SelectItem value="inactive">Inactive students</SelectItem>
                <SelectItem value="program">Specific program</SelectItem>
                <SelectItem value="student">Specific student</SelectItem>
              </SelectContent>
            </Select>

            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger><SelectValue placeholder="Channel" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in_app">In-App</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" />
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="min-h-[180px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Write the message students should receive"
          />

          <div className="rounded-lg border bg-accent/50 p-4 text-sm text-muted-foreground">
            Preview: {message || 'Your notification preview appears here.'}
          </div>

          <Button onClick={() => broadcastMutation.mutate()} disabled={broadcastMutation.isPending}>
            Send Notification
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationsPage;
