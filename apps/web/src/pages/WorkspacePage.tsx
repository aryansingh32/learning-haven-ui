import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apprenticeshipService } from '@/features/apprenticeship/api/apprenticeship.service';
import { supabase } from "@/lib/supabase";
import { tracker } from "@/lib/tracker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Github,
  Loader2,
  Lock,
  PlayCircle,
  Terminal,
  XCircle,
  Clock3,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { handleGitHubOAuthReturn, stripGitHubOAuthParams } from "@/lib/githubOAuth";

type Stage = {
  id: string;
  stage_number: number;
  stage_name: string;
  status: "pending" | "running" | "passed" | "failed";
  xp_for_stage: number;
  failed_details?: { message?: string; console_tail?: string } | null;
};

type Message = {
  role: "user" | "ai";
  content: string;
};

const formatRelativeTime = (value?: string) => {
  if (!value) return "Just now";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const initials = (name?: string) =>
  (name || "Student")
    .split(" ")
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

export default function WorkspacePage() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [stages, setStages] = useState<Stage[]>([]);
  const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("guide");
  const [expandedStages, setExpandedStages] = useState<Record<number, boolean>>({});
  const [expandedAttempts, setExpandedAttempts] = useState<Record<string, boolean>>({});
  const [postContent, setPostContent] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [openReplies, setOpenReplies] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [queriesRemaining, setQueriesRemaining] = useState<number | null>(null);
  const [preFillQuery, setPreFillQuery] = useState("");
  const [helpLoading, setHelpLoading] = useState(false);
  const trackedSubmissionStatus = useRef<string | null>(null);

  useEffect(() => {
    tracker.trackPageView({ page: "workspace", project_id: projectId });
    return () => tracker.trackTimeOnPage({ page: "workspace", project_id: projectId });
  }, [projectId]);

  const workspaceQuery = useQuery({
    queryKey: ["apprenticeship-workspace", projectId],
    queryFn: () => apprenticeshipService.getProjectWorkspace(projectId),
    enabled: Boolean(projectId),
  });

  const workspace = workspaceQuery.data?.workspace;
  const project = workspace?.project;
  const progress = workspace?.progress;
  const enrollmentMeta = progress?.apprenticeship_enrollments;

  const githubStatusQuery = useQuery({
    queryKey: ["apprenticeship-github-status"],
    queryFn: () => apprenticeshipService.getGithubStatus(),
    enabled: Boolean(projectId),
  });

  useEffect(() => {
    handleGitHubOAuthReturn(location.search, () => {
      void githubStatusQuery.refetch();
    });
    if (location.search.includes("github_connected")) {
      const clean = stripGitHubOAuthParams(location.search);
      navigate(`${location.pathname}${clean}`, { replace: true });
    }
  }, [location.search, location.pathname, navigate, githubStatusQuery]);

  const enrollmentQuery = useQuery({
    queryKey: ["apprenticeship-enrollment", progress?.enrollment_id],
    queryFn: () => apprenticeshipService.getEnrollment(progress?.enrollment_id),
    enabled: Boolean(progress?.enrollment_id),
  });

  const submissionsQuery = useQuery({
    queryKey: ["apprenticeship-submissions", progress?.enrollment_id, projectId],
    queryFn: () => apprenticeshipService.getMySubmissions({
      enrollmentId: progress?.enrollment_id,
      projectId,
    }),
    enabled: Boolean(progress?.enrollment_id && projectId),
  });

  const submissions = submissionsQuery.data?.submissions || [];
  const latestSubmission = submissions[0];
  const viewedSubmissionId = activeSubmissionId || latestSubmission?.id || null;

  const stagesQuery = useQuery({
    queryKey: ["apprenticeship-stages", viewedSubmissionId],
    queryFn: () => apprenticeshipService.getSubmissionStages(viewedSubmissionId!),
    enabled: Boolean(viewedSubmissionId),
  });

  useEffect(() => {
    if (stagesQuery.data?.stages) {
      setStages(stagesQuery.data.stages);
    }
  }, [stagesQuery.data]);

  useEffect(() => {
    if (!supabase || !viewedSubmissionId || activeTab !== "tests") {
      return;
    }

    const channel = supabase
      .channel(`submission:${viewedSubmissionId}`)
      .on({ type: "broadcast", event: "stage_result" } as any, () => {
        void queryClient.invalidateQueries({ queryKey: ["apprenticeship-stages", viewedSubmissionId] });
        void queryClient.invalidateQueries({ queryKey: ["apprenticeship-submissions", progress?.enrollment_id, projectId] });
      })
      .on({ type: "broadcast", event: "verification_complete" } as any, () => {
        void queryClient.invalidateQueries({ queryKey: ["apprenticeship-stages", viewedSubmissionId] });
        void queryClient.invalidateQueries({ queryKey: ["apprenticeship-submissions", progress?.enrollment_id, projectId] });
        void queryClient.invalidateQueries({ queryKey: ["apprenticeship-workspace", projectId] });
        void queryClient.invalidateQueries({ queryKey: ["apprenticeship-enrollment", progress?.enrollment_id] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeTab, viewedSubmissionId, queryClient, progress?.enrollment_id, projectId]);

  const programId = enrollmentMeta?.program_id;
  const communityQuery = useQuery({
    queryKey: ["apprenticeship-community", programId, projectId],
    queryFn: () => apprenticeshipService.getCommunityPosts(programId!, { projectId, sort: "recent", page: 1, limit: 20 }),
    enabled: Boolean(programId && activeTab === "community"),
  });

  useEffect(() => {
    if (activeTab === "community" && programId) {
      tracker.track("community_post_viewed", { program_id: programId, project_id: projectId });
    }
    if (activeTab === "help") {
      tracker.track("ai_help_opened", { project_id: projectId });
    }
  }, [activeTab, programId, projectId]);

  useEffect(() => {
    if (preFillQuery) {
      setQuery(preFillQuery);
    }
  }, [preFillQuery]);

  useEffect(() => {
    const status = latestSubmission?.verification_status || null;
    if (!status || trackedSubmissionStatus.current === `${latestSubmission?.id}:${status}`) {
      return;
    }

    if (status === "passed") {
      tracker.track("verification_passed", {
        project_id: projectId,
        xp: latestSubmission?.xp_awarded || 0,
      });
    }

    if (status === "failed") {
      tracker.track("verification_failed", {
        project_id: projectId,
        failed_stages: stages.filter((stage) => stage.status === "failed").length,
      });
    }

    trackedSubmissionStatus.current = `${latestSubmission?.id}:${status}`;
  }, [latestSubmission?.id, latestSubmission?.verification_status, latestSubmission?.xp_awarded, projectId, stages]);

  const startProjectMutation = useMutation({
    mutationFn: () => apprenticeshipService.startProject(projectId),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["apprenticeship-workspace", projectId] });
      tracker.track("repo_created", { project_id: projectId, repo_url: data.repository.html_url });
      toast.success("Repository provisioned");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to start project"),
  });

  const createPostMutation = useMutation({
    mutationFn: () => apprenticeshipService.createPost(programId!, { content: postContent, projectId }),
    onSuccess: () => {
      setPostContent("");
      void queryClient.invalidateQueries({ queryKey: ["apprenticeship-community", programId, projectId] });
      toast.success("Post published");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create post"),
  });

  const upvoteMutation = useMutation({
    mutationFn: (postId: string) => apprenticeshipService.toggleUpvote(postId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["apprenticeship-community", programId, projectId] });
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ postId, content }: { postId: string; content: string }) => apprenticeshipService.createReply(postId, content),
    onSuccess: (_, variables) => {
      setReplyDrafts((current) => ({ ...current, [variables.postId]: "" }));
      setOpenReplies((current) => ({ ...current, [variables.postId]: true }));
      void queryClient.invalidateQueries({ queryKey: ["apprenticeship-community", programId, projectId] });
    },
  });

  const traditionalSteps = project?.traditional_guide?.steps || [];
  const aiPrompts = project?.ai_guide?.recommended_prompts || [];
  const currentConsoleOutput = latestSubmission?.console_output_tail || "$ waiting for git push...";
  const latestFailedStage = stages.find((stage) => stage.status === "failed");
  const firstFailedTest = latestSubmission?.failed_tests?.[0];
  const testStages = project?.verification_requirements?.test_stages
    || (project?.verification_requirements?.required_endpoints || []).map((endpoint: string, index: number) => ({
      stage_number: index + 1,
      name: endpoint,
      xp: 0,
    }));

  const enrollmentProjects = useMemo(() => {
    const items = enrollmentQuery.data?.enrollment?.apprenticeship_project_progress || [];
    return [...items].sort((a: any, b: any) =>
      (a.apprenticeship_projects?.project_number || 0) - (b.apprenticeship_projects?.project_number || 0)
    );
  }, [enrollmentQuery.data]);

  const nextProject = useMemo(() => {
    const currentNumber = project?.project_number || 0;
    return enrollmentProjects.find((item: any) =>
      item.apprenticeship_projects?.project_number === currentNumber + 1
    );
  }, [enrollmentProjects, project?.project_number]);

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      tracker.trackClick("copy_text", { label, project_id: projectId });
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Failed to copy ${label.toLowerCase()}`);
    }
  };

  const connectGitHub = async () => {
    try {
      tracker.track("github_connect_initiated", { project_id: projectId });
      const returnTo = `${window.location.pathname}${window.location.search}`;
      const data = await apprenticeshipService.getGithubAuthUrl(returnTo);
      window.location.href = data.url;
    } catch (error: any) {
      toast.error(error.message || "Failed to start GitHub connection");
    }
  };

  const sendAIHelp = async () => {
    if (!query.trim()) return;
    try {
      setHelpLoading(true);
      const question = query.trim();
      const response = await apprenticeshipService.getAIHelp({
        projectId,
        question,
        context: {
          learningPath: enrollmentMeta?.learning_path,
          lastError: firstFailedTest?.error,
          currentStage: latestFailedStage?.stage_name,
        },
      });

      setMessages((current) => [
        ...current,
        { role: "user", content: question },
        { role: "ai", content: response.response },
      ]);
      setQueriesRemaining(response.queriesRemaining);
      setQuery("");
      tracker.track("ai_help_query", { project_id: projectId, query_length: question.length });
    } catch (error: any) {
      toast.error(error.message || "Failed to get AI help");
    } finally {
      setHelpLoading(false);
    }
  };

  const openAIHelpWithError = () => {
    const message = firstFailedTest?.error || latestFailedStage?.failed_details?.message || "Help me debug my failing stage.";
    setPreFillQuery(message);
    setActiveTab("help");
  };

  const toggleStage = (stageNumber: number) => {
    setExpandedStages((current) => ({ ...current, [stageNumber]: !current[stageNumber] }));
  };

  const renderTestsState = () => {
    if (githubStatusQuery.isLoading) {
      return (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </CardContent>
        </Card>
      );
    }

    if (!githubStatusQuery.data?.connected) {
      return (
        <Card>
          <CardContent className="space-y-5 py-8">
            <div className="flex items-center gap-3">
              <Github className="h-6 w-6 text-primary" />
              <div>
                <h3 className="text-xl font-semibold">Connect GitHub to Start</h3>
                <p className="text-sm text-muted-foreground">
                  You need to connect your GitHub account once. This lets us create your project repository and verify your code automatically.
                </p>
              </div>
            </div>
            <Button onClick={connectGitHub}>
              <Github className="mr-2 h-4 w-4" />
              Connect GitHub Account
            </Button>
            <button type="button" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              New to Git? Follow our 5-step setup guide →
            </button>
          </CardContent>
        </Card>
      );
    }

    if (progress?.status === "available") {
      return (
        <Card>
          <CardHeader>
            <CardTitle>What will be tested</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(testStages || []).map((stage: any, index: number) => (
              <div key={`${stage.name}-${index}`} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>{stage.name || `Stage ${index + 1}`}</span>
                </div>
                <Badge variant="outline">Stage {stage.stage_number || index + 1}{stage.xp ? ` · ${stage.xp} XP` : ""}</Badge>
              </div>
            ))}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
              Total: {Number(project?.verification_requirements?.required_tests || testStages?.length || 0)} checks
            </div>
            <Button
              onClick={() => {
                tracker.track("project_started", { project_id: projectId });
                startProjectMutation.mutate();
              }}
              disabled={startProjectMutation.isPending}
            >
              {startProjectMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
              Start Project — Get Your Repository
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (progress?.status === "in_progress" && submissions.length === 0) {
      return (
        <Card>
          <CardContent className="space-y-5 py-8">
            <div className="flex items-center gap-3 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
              <div>
                <h3 className="text-xl font-semibold">Your repository is ready!</h3>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Clone your project:</p>
              <div className="flex items-center justify-between rounded-xl border bg-muted/40 p-3 font-mono text-sm">
                <span className="truncate">git clone {progress.github_repo_url}</span>
                <Button size="sm" variant="ghost" onClick={() => copyText(`git clone ${progress.github_repo_url}`, "Clone command")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4 font-mono text-sm">
              <div>$ git add . &amp;&amp; git commit -m "progress"</div>
              <div className="mt-2">$ git push origin main <span className="font-sans text-muted-foreground">← triggers tests</span></div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock3 className="h-4 w-4" />
              Listening for your push... (push to <code>main</code> branch only)
            </div>
          </CardContent>
        </Card>
      );
    }

    if (latestSubmission?.verification_status === "testing") {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Testing your code...</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stages.map((stage) => {
              const isExpanded = expandedStages[stage.stage_number] || false;
              return (
                <div
                  key={stage.id}
                  className={cn(
                    "rounded-xl border p-3 transition-all",
                    stage.status === "passed" && "border-emerald-200 bg-emerald-50/50",
                    stage.status === "failed" && "border-rose-200 bg-rose-50/50",
                    stage.status === "running" && "border-blue-200 bg-blue-50/50 animate-pulse",
                    stage.status === "pending" && "border-border bg-muted/20"
                  )}
                >
                  <button type="button" className="flex w-full items-center justify-between gap-4" onClick={() => stage.status === "failed" && toggleStage(stage.stage_number)}>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {stage.status === "passed" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                      {stage.status === "failed" && <XCircle className="h-4 w-4 text-rose-600" />}
                      {stage.status === "running" && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                      {stage.status === "pending" && <Clock3 className="h-4 w-4 text-muted-foreground" />}
                      {stage.stage_name}
                    </div>
                    {stage.status === "passed" ? <Badge variant="outline">+{stage.xp_for_stage} XP</Badge> : null}
                  </button>
                  {stage.status === "failed" && isExpanded ? (
                    <div className="mt-3 space-y-2">
                      <div className="rounded-xl border border-rose-200 bg-white/80 p-3 text-sm text-rose-700">
                        {stage.failed_details?.message || "Stage failed."}
                      </div>
                      {stage.failed_details?.console_tail ? (
                        <div className="rounded-xl bg-zinc-950 p-3 font-mono text-xs text-zinc-100">
                          <pre className="whitespace-pre-wrap">{stage.failed_details.console_tail}</pre>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      );
    }

    if (latestSubmission?.verification_status === "passed") {
      return (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              All tests passed!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl bg-white/70 p-3 text-sm font-medium text-emerald-700">
              +{latestSubmission.xp_awarded || 0} XP earned
            </div>
            {stages.map((stage) => (
              <div key={stage.id} className="flex items-center justify-between rounded-xl border border-emerald-200 bg-white/70 p-3 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  {stage.stage_name}
                </div>
                <Badge variant="outline">+{stage.xp_for_stage} XP</Badge>
              </div>
            ))}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border bg-white/70 p-3 text-sm">Code Quality: {latestSubmission.code_quality_score || "—"}/100</div>
              <div className="rounded-xl border bg-white/70 p-3 text-sm">Time to complete: {formatRelativeTime(progress?.started_at)}</div>
            </div>
            {nextProject ? (
              <div className="rounded-xl border border-emerald-200 bg-white/70 p-4">
                <p className="font-medium text-emerald-700">Project {nextProject.apprenticeship_projects?.project_number} is now unlocked!</p>
                <Button className="mt-3" onClick={() => navigate(`/apprenticeship/projects/${nextProject.project_id}`)}>
                  Start Project {nextProject.apprenticeship_projects?.project_number} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      );
    }

    if (latestSubmission?.verification_status === "failed") {
      return (
        <Card className="border-rose-200 bg-rose-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-rose-700">
              <XCircle className="h-5 w-5" />
              Some tests failed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stages.map((stage) => {
              const isFailed = stage.status === "failed";
              const isExpanded = isFailed ? (expandedStages[stage.stage_number] ?? true) : false;
              return (
                <div key={stage.id} className={cn("rounded-xl border p-3", isFailed ? "border-rose-200 bg-white/90" : "border-emerald-200 bg-white/70")}>
                  <button type="button" className="flex w-full items-center justify-between gap-4" onClick={() => isFailed && toggleStage(stage.stage_number)}>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {isFailed ? <XCircle className="h-4 w-4 text-rose-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                      {stage.stage_name}
                    </div>
                    {isFailed ? (isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : <Badge variant="outline">+{stage.xp_for_stage} XP</Badge>}
                  </button>
                  {isFailed && isExpanded ? (
                    <div className="mt-3 space-y-2">
                      <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                        {stage.failed_details?.message || firstFailedTest?.error || "Stage failed."}
                      </div>
                      <div className="rounded-xl bg-zinc-950 p-3 font-mono text-xs text-zinc-100">
                        <pre className="whitespace-pre-wrap">{stage.failed_details?.console_tail || latestSubmission.console_output_tail || "No console output captured."}</pre>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
            <div className="rounded-xl border bg-white/70 p-4 text-sm">
              Fix the issue and push again — no limit on attempts!
            </div>
            <Button variant="outline" onClick={openAIHelpWithError}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Get AI Help with this error →
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          Push to <code>main</code> to trigger verification.
        </CardContent>
      </Card>
    );
  };

  if (workspaceQuery.isLoading) {
    return (
      <div className="container mx-auto flex justify-center px-4 py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto px-4 py-20">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            This project is unavailable or still locked.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)_360px]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-lg">Program Flow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                <div className="text-sm font-semibold">Project {project.project_number}</div>
                <div className="text-sm text-muted-foreground">{project.title}</div>
              </div>
              <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Next project unlocks automatically after pass
                </div>
              </div>
              <div className="rounded-xl border p-3 text-sm">
                <div className="font-medium">Estimated effort</div>
                <div className="text-muted-foreground">{project.estimated_hours || "?"} hours</div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Badge variant="outline" className="mb-3">Build and verify</Badge>
                <h1 className="text-3xl font-bold">{project.title}</h1>
                <p className="mt-2 max-w-3xl text-muted-foreground">{project.description}</p>
              </div>
              <div className="flex flex-col gap-2">
                {progress?.github_repo_url ? (
                  <Button variant="outline" onClick={() => copyText(progress.github_repo_url, "Repository URL")}>
                    <Github className="mr-2 h-4 w-4" />
                    Copy Repo URL
                  </Button>
                ) : null}
              </div>
            </div>

            <Tabs
              value={activeTab}
              onValueChange={(value) => {
                setActiveTab(value);
                tracker.track("tab_switch", { tab: value, project_id: projectId });
              }}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="guide">Guide</TabsTrigger>
                <TabsTrigger value="tests">Tests</TabsTrigger>
                <TabsTrigger value="community">Community</TabsTrigger>
                <TabsTrigger value="help">AI Help</TabsTrigger>
                <TabsTrigger value="resources">Resources</TabsTrigger>
              </TabsList>

              <TabsContent value="guide" className="mt-6 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Traditional Path</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {traditionalSteps.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Traditional guide content has not been authored yet.</p>
                    ) : traditionalSteps.map((step: any) => (
                      <div
                        key={step.step_number}
                        className="rounded-2xl border p-4"
                        onClick={() => tracker.track("guide_step_expanded", { step_number: step.step_number, project_id: projectId })}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <Badge variant="secondary">Step {step.step_number}</Badge>
                          <span className="font-semibold">{step.title}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{step.description}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>AI-Assisted Path</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{project.ai_guide?.overview || "AI path content has not been authored yet."}</p>
                    {aiPrompts.map((prompt: any, index: number) => (
                      <div key={`${prompt.phase}-${index}`} className="rounded-2xl border p-4">
                        <div className="mb-2 flex items-center gap-2">
                          <Badge variant="outline">{prompt.phase}</Badge>
                          <span className="text-xs text-muted-foreground">{prompt.expected_outcome}</span>
                        </div>
                        <div className="rounded-xl bg-muted p-3 text-sm">{prompt.prompt}</div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2"
                          onClick={() => {
                            tracker.track("prompt_copied", { phase: prompt.phase, project_id: projectId });
                            copyText(prompt.prompt, "Prompt");
                          }}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copy prompt
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="tests" className="mt-6 space-y-6">
                {renderTestsState()}

                <Card>
                  <CardHeader>
                    <CardTitle>Previous Attempts</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {submissions.slice(0, 5).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No attempts yet.</p>
                    ) : submissions.slice(0, 5).map((submission: any) => {
                      const open = expandedAttempts[submission.id] || false;
                      const stageCount = submission.total_tests || 0;
                      const passedCount = submission.passed_tests || 0;
                      return (
                        <div key={submission.id} className="rounded-xl border">
                          <button
                            type="button"
                            className="flex w-full items-center justify-between p-3 text-left"
                            onClick={() => {
                              setExpandedAttempts((current) => ({ ...current, [submission.id]: !current[submission.id] }));
                              setActiveSubmissionId(submission.id);
                            }}
                          >
                            <div className="text-sm">
                              <div className="font-medium">
                                Attempt #{submission.attempt_number} | {formatRelativeTime(submission.submitted_at)} | {submission.verification_status === "passed" ? "✅ Passed" : "❌ Failed"} | {passedCount}/{stageCount} stages
                              </div>
                            </div>
                            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          {open ? (
                            <div className="border-t p-3">
                              <div className="rounded-xl bg-zinc-950 p-3 font-mono text-xs text-zinc-100">
                                <pre className="whitespace-pre-wrap">{submission.console_output_tail || "No console output captured."}</pre>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="community" className="mt-6 space-y-6">
                <Card>
                  <CardContent className="space-y-4 py-6">
                    <div className="rounded-2xl border p-4">
                      <textarea
                        value={postContent}
                        onChange={(event) => setPostContent(event.target.value)}
                        placeholder="Share your progress, ask for help, or celebrate a win..."
                        className="min-h-[80px] w-full resize-none bg-transparent text-sm outline-none"
                      />
                      <div className="mt-3 flex justify-end">
                        <Button
                          onClick={() => createPostMutation.mutate()}
                          disabled={!postContent.trim() || createPostMutation.isPending}
                        >
                          Post
                        </Button>
                      </div>
                    </div>

                    {(communityQuery.data?.posts || []).map((post: any) => (
                      <Card key={post.id}>
                        <CardContent className="space-y-4 py-5">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                              {initials(post.user?.name)}
                            </div>
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{post.user?.name}</span>
                                {post.project ? <Badge variant="outline">{post.project.title}</Badge> : null}
                                <span className="text-xs text-muted-foreground">{formatRelativeTime(post.created_at)}</span>
                              </div>
                              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{post.content}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <Button
                              size="sm"
                              variant={post.is_upvoted_by_you ? "default" : "outline"}
                              onClick={() => upvoteMutation.mutate(post.id)}
                            >
                              {post.is_upvoted_by_you ? "Upvoted" : "Upvote"} · {post.upvotes}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setOpenReplies((current) => ({ ...current, [post.id]: !current[post.id] }))}
                            >
                              Reply · {post.replies_count}
                            </Button>
                          </div>

                          {openReplies[post.id] ? (
                            <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                              {(post.replies || []).map((reply: any) => (
                                <div key={reply.id} className="rounded-xl border bg-background p-3">
                                  <div className="mb-1 text-sm font-medium">{reply.user?.name}</div>
                                  <p className="text-sm text-muted-foreground">{reply.content}</p>
                                </div>
                              ))}
                              <div className="flex gap-2">
                                <input
                                  value={replyDrafts[post.id] || ""}
                                  onChange={(event) => setReplyDrafts((current) => ({ ...current, [post.id]: event.target.value }))}
                                  placeholder="Write a reply..."
                                  className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
                                />
                                <Button
                                  onClick={() => replyMutation.mutate({ postId: post.id, content: replyDrafts[post.id] || "" })}
                                  disabled={!(replyDrafts[post.id] || "").trim() || replyMutation.isPending}
                                >
                                  Reply
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="help" className="mt-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle>AI Project Assistant</CardTitle>
                      {queriesRemaining !== null ? <Badge variant="outline">{queriesRemaining}/10 remaining this hour</Badge> : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
                      Context: Project {project.title} · {enrollmentMeta?.learning_path === "ai_assisted" ? "AI-Assisted" : "Traditional"} path
                      {latestFailedStage ? ` · Last failed: ${latestFailedStage.stage_name}` : ""}
                    </div>

                    <ScrollArea className="h-72 rounded-xl border p-4">
                      <div className="space-y-3">
                        {messages.length === 0 ? (
                          <div className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                            Ask anything about this project. I have context on your current progress.
                          </div>
                        ) : messages.map((message, index) => (
                          <div
                            key={`${message.role}-${index}`}
                            className={cn(
                              "rounded-xl p-3 text-sm",
                              message.role === "user" ? "ml-8 bg-primary/10" : "mr-8 bg-muted"
                            )}
                          >
                            {message.content}
                          </div>
                        ))}
                        {helpLoading ? <div className="text-sm text-muted-foreground">Thinking...</div> : null}
                      </div>
                    </ScrollArea>

                    <div className="flex gap-2">
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void sendAIHelp();
                          }
                        }}
                        placeholder="Ask about this project..."
                        className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
                      />
                      <Button onClick={() => void sendAIHelp()} disabled={!query.trim() || helpLoading}>
                        Send
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="resources" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Helpful Resources</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(project.helpful_resources || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No resources linked yet.</p>
                    ) : (
                      project.helpful_resources.map((resource: any) => (
                        <a
                          key={resource.url}
                          href={resource.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-xl border p-3 hover:border-primary/30"
                          onClick={() => tracker.track("resource_link_clicked", { project_id: projectId, url: resource.url, title: resource.title })}
                        >
                          <div className="font-medium">{resource.title}</div>
                          <div className="text-sm text-muted-foreground">{resource.url}</div>
                        </a>
                      ))
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Terminal className="h-5 w-5" />
                  Live Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className={cn("h-2.5 w-2.5 rounded-full", progress?.github_repo_url ? "bg-emerald-500" : "bg-amber-500")} />
                  {progress?.github_repo_url ? "Listening for push..." : "Start the project to provision a repo"}
                </div>
                {stages.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    No verification stages yet.
                  </div>
                ) : stages.map((stage) => (
                  <div key={stage.id} className="rounded-xl border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{stage.stage_name}</span>
                      <Badge variant="outline">{stage.status}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Console Tail</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-56 rounded-xl bg-zinc-950 p-4 font-mono text-xs text-zinc-100">
                  <pre className="whitespace-pre-wrap">{currentConsoleOutput}</pre>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Attempts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {submissions.slice(0, 5).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No attempts yet.</p>
                ) : submissions.slice(0, 5).map((submission: any) => (
                  <button
                    key={submission.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border p-3 text-left hover:border-primary/30"
                    onClick={() => setActiveSubmissionId(submission.id)}
                  >
                    <div>
                      <div className="font-medium">Attempt #{submission.attempt_number}</div>
                      <div className="text-xs text-muted-foreground">{formatRelativeTime(submission.submitted_at)}</div>
                    </div>
                    <Badge variant="outline">{submission.verification_status}</Badge>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
