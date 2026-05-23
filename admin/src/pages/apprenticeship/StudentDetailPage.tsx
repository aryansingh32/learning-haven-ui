import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { apprenticeshipApi } from '../../services/apprenticeship.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Github } from 'lucide-react';

type DetailTab = 'enrollments' | 'submissions' | 'activity' | 'certificates';

const StudentDetailPage = () => {
  const { userId = '' } = useParams();
  const [tab, setTab] = useState<DetailTab>('enrollments');

  const { data, isLoading } = useQuery({
    queryKey: ['apprenticeship-admin-student', userId],
    queryFn: () => apprenticeshipApi.getStudentDetail(userId),
    enabled: Boolean(userId),
  });

  const detail = data?.detail;
  const user = detail?.user;
  const github = detail?.github;

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{user?.full_name || 'Student'}</h2>
          <p className="text-muted-foreground">{user?.email}</p>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{github?.is_active ? `GitHub: @${github.github_username}` : 'GitHub not connected'}</Badge>
            <span>XP: {user?.xp || 0}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">Add XP</Button>
          <Button variant="outline" size="sm">Force Unlock</Button>
          <Button variant="outline" size="sm">Send Notification</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['enrollments', 'submissions', 'activity', 'certificates'] as DetailTab[]).map((value) => (
          <Button key={value} variant={tab === value ? 'default' : 'outline'} size="sm" onClick={() => setTab(value)}>
            {value}
          </Button>
        ))}
      </div>

      {tab === 'enrollments' && (
        <div className="grid gap-4">
          {(detail?.enrollments || []).map((enrollment: any) => (
            <Card key={enrollment.id} className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">{enrollment.apprenticeship_programs?.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span>Progress: {enrollment.progress_percentage}%</span>
                  <span>Completed: {enrollment.completed_projects}/{enrollment.total_projects}</span>
                  <span>Status: {enrollment.status}</span>
                </div>
                <div className="space-y-2">
                  {(enrollment.apprenticeship_project_progress || []).map((progress: any) => (
                    <div key={progress.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                      <div>
                        <p className="font-medium">{progress.apprenticeship_projects?.title}</p>
                        <p className="text-muted-foreground">{progress.status}</p>
                      </div>
                      {progress.github_repo_url ? (
                        <a href={progress.github_repo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary">
                          <Github className="h-4 w-4" />
                          Repo
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === 'submissions' && (
        <Card className="border-0 shadow-md">
          <CardContent className="space-y-3 p-6">
            {(detail?.submissions || []).map((submission: any) => (
              <div key={submission.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{submission.github_repo_full_name || 'Submission'}</p>
                    <p className="text-sm text-muted-foreground">{new Date(submission.submitted_at).toLocaleString()}</p>
                  </div>
                  <Badge variant="outline">{submission.verification_status}</Badge>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded bg-zinc-950 p-3 text-xs text-zinc-100">{submission.console_output_tail || 'No console output.'}</pre>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {tab === 'activity' && (
        <Card className="border-0 shadow-md">
          <CardContent className="space-y-3 p-6">
            {(detail?.events || []).map((event: any) => (
              <div key={event.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{event.event_category}</Badge>
                    <span className="font-medium">{event.event_type}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Page: {event.page_url || '—'}</p>
                <pre className="mt-2 whitespace-pre-wrap rounded bg-accent/60 p-3 text-xs">{JSON.stringify(event.event_data || {}, null, 2)}</pre>
                <p className="mt-2 text-xs text-muted-foreground">Session: {event.session_id}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {tab === 'certificates' && (
        <Card className="border-0 shadow-md">
          <CardContent className="space-y-3 p-6">
            {(detail?.certificates || []).map((certificate: any) => (
              <div key={certificate.id} className="rounded-lg border p-3">
                <p className="font-medium">{certificate.verification_code}</p>
                <p className="text-sm text-muted-foreground">{certificate.final_grade} • {new Date(certificate.issued_at).toLocaleDateString()}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StudentDetailPage;
