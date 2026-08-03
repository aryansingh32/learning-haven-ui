import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apprenticeshipService } from '@/features/apprenticeship/api/apprenticeship.service';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ProgressRing";
import { Loader2, CalendarDays, ArrowRight } from "lucide-react";

export default function ApprenticeshipDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["apprenticeship-enrollments"],
    queryFn: () => apprenticeshipService.getMyEnrollments(),
  });

  const enrollments = data?.enrollments || [];

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-20 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-10 space-y-8">
      <div>
        <Badge variant="outline" className="mb-3">Student Dashboard</Badge>
        <h1 className="text-3xl font-bold">Apprenticeship Progress</h1>
        <p className="mt-2 text-muted-foreground">
          Track enrolled programs, remaining time, and your current build queue.
        </p>
      </div>

      {enrollments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            You are not enrolled in any apprenticeship program yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {enrollments.map((enrollment: any) => {
            const program = enrollment.apprenticeship_programs;
            const daysRemaining = Math.max(
              0,
              Math.ceil((new Date(enrollment.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            );

            return (
              <Card key={enrollment.id} className="overflow-hidden">
                <CardHeader className="border-b bg-muted/20">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>{program?.title}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">{program?.description}</p>
                    </div>
                    <Badge variant="outline">{enrollment.learning_path}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="flex items-center gap-6">
                    <ProgressRing
                      value={Number(enrollment.progress_percentage || 0)}
                      size={92}
                      label={`${Math.round(Number(enrollment.progress_percentage || 0))}%`}
                    />
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">
                        {enrollment.completed_projects} / {enrollment.total_projects} projects completed
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        {daysRemaining} days remaining
                      </div>
                      <div className="text-sm">
                        Status: <span className="font-medium capitalize">{enrollment.status}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-muted-foreground">Current project</div>
                    <div className="mt-1 text-lg font-semibold">Project {enrollment.current_project_number}</div>
                  </div>

                  <Button asChild className="w-full">
                    <Link to={`/apprenticeship/enrollments/${enrollment.id}`}>
                      Open Program Workspace
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
