import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apprenticeshipService } from '@/features/apprenticeship/api/apprenticeship.service';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, ArrowRight } from "lucide-react";

export default function ApprenticeshipEnrollmentPage() {
  const { enrollmentId = "" } = useParams<{ enrollmentId: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["apprenticeship-enrollment", enrollmentId],
    queryFn: () => apprenticeshipService.getEnrollment(enrollmentId),
    enabled: Boolean(enrollmentId),
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-20 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const enrollment = data?.enrollment;
  const progressRows = (enrollment?.apprenticeship_project_progress || []).sort(
    (a: any, b: any) => a.apprenticeship_projects.project_number - b.apprenticeship_projects.project_number
  );

  if (!enrollment) {
    return (
      <div className="container mx-auto px-4 py-20">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Enrollment not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-10 space-y-8">
      <div>
        <Badge variant="outline" className="mb-3">{enrollment.learning_path}</Badge>
        <h1 className="text-3xl font-bold">{enrollment.apprenticeship_programs?.title}</h1>
        <p className="mt-2 text-muted-foreground">{enrollment.apprenticeship_programs?.description}</p>
      </div>

      <div className="grid gap-4">
        {progressRows.map((progress: any) => {
          const project = progress.apprenticeship_projects;
          const isLocked = progress.status === "locked";
          return (
            <Card key={progress.id}>
              <CardContent className="flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">Project {project.project_number}</Badge>
                    <Badge variant="outline" className="capitalize">{progress.status.replace("_", " ")}</Badge>
                  </div>
                  <h2 className="mt-3 text-xl font-semibold">{project.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
                </div>
                {isLocked ? (
                  <Button variant="outline" disabled>
                    <Lock className="mr-2 h-4 w-4" />
                    Locked
                  </Button>
                ) : (
                  <Button asChild>
                    <Link to={`/apprenticeship/projects/${project.id}`}>
                      Open Workspace
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
