import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { coursesService } from '../services/courses.service';
import {
  chaptersAdminService,
  type AdminChapter,
  type AdminChapterDetail,
  type AdminChapterStep,
} from '../services/chapters.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Save, Trash2, BookOpen, FileJson, ListOrdered } from 'lucide-react';
import { toast } from 'sonner';

type ChapterFormState = {
  course_id: string;
  chapter_number: number;
  title: string;
  topic_tag: string;
  difficulty: string;
  est_minutes: number;
  story_hook: string;
  whatsapp_msg: string;
};

type StepDraft = {
  localId: string;
  step_number: number;
  type: string;
  title: string;
  contentJson: string;
};

const EMPTY_FORM: ChapterFormState = {
  course_id: '',
  chapter_number: 1,
  title: '',
  topic_tag: '',
  difficulty: 'beginner',
  est_minutes: 30,
  story_hook: '',
  whatsapp_msg: '',
};

function makeStepDraft(step?: AdminChapterStep, index = 0): StepDraft {
  return {
    localId: step?.id || `step-${index}-${Date.now()}`,
    step_number: step?.step_number ?? index + 1,
    type: step?.type || 'story_hook',
    title: step?.title || '',
    contentJson: JSON.stringify(step?.content || {}, null, 2),
  };
}

function sanitizeContentPayload(content: Record<string, unknown>) {
  const blocked = new Set(['id', 'chapter_id', 'created_at', 'updated_at']);
  return Object.fromEntries(Object.entries(content).filter(([key]) => !blocked.has(key)));
}

const Chapters = () => {
  const queryClient = useQueryClient();
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [chapterForm, setChapterForm] = useState<ChapterFormState>(EMPTY_FORM);
  const [contentJson, setContentJson] = useState('{\n  "video_youtube_id": "",\n  "video_title": "",\n  "quiz": [],\n  "tasks": []\n}');
  const [stepDrafts, setStepDrafts] = useState<StepDraft[]>([]);

  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ['admin-courses'],
    queryFn: coursesService.list,
  });

  useEffect(() => {
    if (!selectedCourseId && courses?.[0]?.id) {
      setSelectedCourseId(courses[0].id);
      setChapterForm((prev) => ({ ...prev, course_id: courses[0].id }));
    }
  }, [courses, selectedCourseId]);

  const chaptersQuery = useQuery({
    queryKey: ['admin-chapters', selectedCourseId],
    queryFn: () => chaptersAdminService.list(selectedCourseId),
    enabled: Boolean(selectedCourseId),
  });

  const detailQuery = useQuery({
    queryKey: ['admin-chapter', selectedChapterId],
    queryFn: () => chaptersAdminService.get(selectedChapterId),
    enabled: Boolean(selectedChapterId),
  });

  useEffect(() => {
    if (!selectedChapterId) {
      setChapterForm((prev) => ({
        ...EMPTY_FORM,
        course_id: selectedCourseId || prev.course_id,
      }));
      setContentJson('{\n  "video_youtube_id": "",\n  "video_title": "",\n  "quiz": [],\n  "tasks": []\n}');
      setStepDrafts([]);
      return;
    }

    const detail = detailQuery.data as AdminChapterDetail | undefined;
    if (!detail?.chapter) return;

    setChapterForm({
      course_id: String(detail.chapter.course_id || selectedCourseId),
      chapter_number: Number(detail.chapter.chapter_number || 1),
      title: String(detail.chapter.title || ''),
      topic_tag: String(detail.chapter.topic_tag || ''),
      difficulty: String(detail.chapter.difficulty || 'beginner'),
      est_minutes: Number(detail.chapter.est_minutes || 30),
      story_hook: String(detail.chapter.story_hook || ''),
      whatsapp_msg: String(detail.chapter.whatsapp_msg || ''),
    });
    setContentJson(JSON.stringify(sanitizeContentPayload(detail.content || {}), null, 2));
    setStepDrafts((detail.steps || []).map((step, index) => makeStepDraft(step, index)));
  }, [detailQuery.data, selectedChapterId, selectedCourseId]);

  const selectedCourse = useMemo(
    () => courses?.find((course) => course.id === selectedCourseId),
    [courses, selectedCourseId]
  );

  const resetForCreate = () => {
    setSelectedChapterId('');
    setChapterForm({
      ...EMPTY_FORM,
      course_id: selectedCourseId,
      chapter_number: (chaptersQuery.data?.length || 0) + 1,
    });
    setContentJson('{\n  "video_youtube_id": "",\n  "video_title": "",\n  "quiz": [],\n  "tasks": []\n}');
    setStepDrafts([]);
  };

  const createMutation = useMutation({
    mutationFn: (payload: ChapterFormState) =>
      chaptersAdminService.create({
        ...payload,
        course_id: payload.course_id,
        chapter_number: Number(payload.chapter_number),
        est_minutes: Number(payload.est_minutes),
      }),
    onSuccess: async (chapter: AdminChapter) => {
      toast.success('Chapter created');
      await queryClient.invalidateQueries({ queryKey: ['admin-chapters', chapter.course_id] });
      setSelectedChapterId(chapter.id);
    },
    onError: (error: any) => toast.error(error.response?.data?.error || error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ChapterFormState }) =>
      chaptersAdminService.update(id, {
        ...payload,
        chapter_number: Number(payload.chapter_number),
        est_minutes: Number(payload.est_minutes),
      }),
    onSuccess: async () => {
      toast.success('Chapter updated');
      await queryClient.invalidateQueries({ queryKey: ['admin-chapters', selectedCourseId] });
      await queryClient.invalidateQueries({ queryKey: ['admin-chapter', selectedChapterId] });
    },
    onError: (error: any) => toast.error(error.response?.data?.error || error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => chaptersAdminService.delete(id),
    onSuccess: async () => {
      toast.success('Chapter deleted');
      await queryClient.invalidateQueries({ queryKey: ['admin-chapters', selectedCourseId] });
      resetForCreate();
    },
    onError: (error: any) => toast.error(error.response?.data?.error || error.message),
  });

  const saveContentMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      chaptersAdminService.upsertContent(id, payload),
    onSuccess: async () => {
      toast.success('Chapter content saved');
      await queryClient.invalidateQueries({ queryKey: ['admin-chapter', selectedChapterId] });
    },
    onError: (error: any) => toast.error(error.response?.data?.error || error.message),
  });

  const saveStepsMutation = useMutation({
    mutationFn: ({ id, steps }: { id: string; steps: AdminChapterStep[] }) =>
      chaptersAdminService.replaceSteps(id, steps),
    onSuccess: async () => {
      toast.success('Chapter steps saved');
      await queryClient.invalidateQueries({ queryKey: ['admin-chapter', selectedChapterId] });
      await queryClient.invalidateQueries({ queryKey: ['admin-chapters', selectedCourseId] });
    },
    onError: (error: any) => toast.error(error.response?.data?.error || error.message),
  });

  const saveChapter = () => {
    if (!chapterForm.course_id || !chapterForm.title.trim()) {
      toast.error('Course and title are required');
      return;
    }

    if (selectedChapterId) {
      updateMutation.mutate({ id: selectedChapterId, payload: chapterForm });
      return;
    }

    createMutation.mutate(chapterForm);
  };

  const saveContent = () => {
    if (!selectedChapterId) {
      toast.error('Create the chapter first');
      return;
    }

    try {
      const parsed = JSON.parse(contentJson || '{}') as Record<string, unknown>;
      saveContentMutation.mutate({ id: selectedChapterId, payload: parsed });
    } catch {
      toast.error('Chapter content must be valid JSON');
    }
  };

  const saveSteps = () => {
    if (!selectedChapterId) {
      toast.error('Create the chapter first');
      return;
    }

    try {
      const payload: AdminChapterStep[] = stepDrafts.map((step, index) => ({
        step_number: Number(step.step_number) || index + 1,
        type: step.type.trim() || 'doc',
        title: step.title.trim() || `Step ${index + 1}`,
        content: JSON.parse(step.contentJson || '{}') as Record<string, unknown>,
      }));
      saveStepsMutation.mutate({ id: selectedChapterId, steps: payload });
    } catch {
      toast.error('Every step content block must be valid JSON');
    }
  };

  const updateStepDraft = (localId: string, patch: Partial<StepDraft>) => {
    setStepDrafts((prev) => prev.map((step) => (step.localId === localId ? { ...step, ...patch } : step)));
  };

  const addStepDraft = () => {
    setStepDrafts((prev) => [
      ...prev,
      makeStepDraft(undefined, prev.length),
    ]);
  };

  const removeStepDraft = (localId: string) => {
    setStepDrafts((prev) =>
      prev
        .filter((step) => step.localId !== localId)
        .map((step, index) => ({ ...step, step_number: index + 1 }))
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Learn Chapters</h2>
          <p className="mt-1 text-muted-foreground">Manage chapter metadata, chapter content, and dynamic step flows.</p>
        </div>
        <Button onClick={resetForCreate}>
          <Plus className="mr-2 h-4 w-4" /> New Chapter
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Chapters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Course</Label>
              <Select
                value={selectedCourseId}
                onValueChange={(value) => {
                  setSelectedCourseId(value);
                  setSelectedChapterId('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={coursesLoading ? 'Loading courses...' : 'Select course'} />
                </SelectTrigger>
                <SelectContent>
                  {(courses || []).map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              {chaptersQuery.isLoading ? (
                <div className="flex h-24 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : !(chaptersQuery.data || []).length ? (
                <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  No chapters yet for this course.
                </div>
              ) : (
                (chaptersQuery.data || []).map((chapter) => (
                  <button
                    key={chapter.id}
                    type="button"
                    onClick={() => setSelectedChapterId(chapter.id)}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                      selectedChapterId === chapter.id ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-primary" />
                        <span className="font-medium">Chapter {chapter.chapter_number}</span>
                      </div>
                      <Badge variant="secondary">{chapter.step_count || 0} steps</Badge>
                    </div>
                    <p className="mt-2 text-sm font-medium">{chapter.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{chapter.topic_tag || 'No topic tag'}</p>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Chapter Metadata</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Course</Label>
                <Input value={selectedCourse?.title || 'Select a course'} disabled />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Chapter Number</Label>
                <Input
                  type="number"
                  value={chapterForm.chapter_number}
                  onChange={(e) => setChapterForm((prev) => ({ ...prev, chapter_number: Number(e.target.value) || 1 }))}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">Title</Label>
                <Input
                  value={chapterForm.title}
                  onChange={(e) => setChapterForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Variables and Memory"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Topic Tag</Label>
                <Input
                  value={chapterForm.topic_tag}
                  onChange={(e) => setChapterForm((prev) => ({ ...prev, topic_tag: e.target.value }))}
                  placeholder="variables"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Difficulty</Label>
                <Select
                  value={chapterForm.difficulty}
                  onValueChange={(value) => setChapterForm((prev) => ({ ...prev, difficulty: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Estimated Minutes</Label>
                <Input
                  type="number"
                  value={chapterForm.est_minutes}
                  onChange={(e) => setChapterForm((prev) => ({ ...prev, est_minutes: Number(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">Story Hook</Label>
                <Textarea
                  value={chapterForm.story_hook}
                  onChange={(e) => setChapterForm((prev) => ({ ...prev, story_hook: e.target.value }))}
                  className="min-h-[90px]"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">WhatsApp Message</Label>
                <Textarea
                  value={chapterForm.whatsapp_msg}
                  onChange={(e) => setChapterForm((prev) => ({ ...prev, whatsapp_msg: e.target.value }))}
                  className="min-h-[90px]"
                />
              </div>
              <div className="md:col-span-2 flex flex-wrap gap-2">
                <Button
                  onClick={saveChapter}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {selectedChapterId ? 'Save Chapter' : 'Create Chapter'}
                </Button>
                {selectedChapterId ? (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (window.confirm('Delete this chapter and all its steps/content?')) {
                        deleteMutation.mutate(selectedChapterId);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileJson className="h-4 w-4" /> Chapter Content JSON
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={contentJson}
                onChange={(e) => setContentJson(e.target.value)}
                className="min-h-[260px] font-mono text-xs"
              />
              <Button onClick={saveContent} disabled={!selectedChapterId || saveContentMutation.isPending}>
                <Save className="mr-2 h-4 w-4" /> Save Content
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between gap-3 text-base">
                <span className="flex items-center gap-2">
                  <ListOrdered className="h-4 w-4" /> Step Flow
                </span>
                <Button size="sm" variant="outline" onClick={addStepDraft}>
                  <Plus className="mr-1 h-3 w-3" /> Add Step
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {stepDrafts.length === 0 ? (
                <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  No steps yet. Add the first step for this chapter.
                </div>
              ) : (
                stepDrafts.map((step) => (
                  <div key={step.localId} className="rounded-xl border p-4 space-y-3">
                    <div className="grid gap-3 md:grid-cols-[100px_180px_minmax(0,1fr)_auto]">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Order</Label>
                        <Input
                          type="number"
                          value={step.step_number}
                          onChange={(e) => updateStepDraft(step.localId, { step_number: Number(e.target.value) || 1 })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Type</Label>
                        <Input
                          value={step.type}
                          onChange={(e) => updateStepDraft(step.localId, { type: e.target.value })}
                          placeholder="quiz"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Title</Label>
                        <Input
                          value={step.title}
                          onChange={(e) => updateStepDraft(step.localId, { title: e.target.value })}
                          placeholder="Variables story hook"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button size="icon" variant="ghost" onClick={() => removeStepDraft(step.localId)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Step Content JSON</Label>
                      <Textarea
                        value={step.contentJson}
                        onChange={(e) => updateStepDraft(step.localId, { contentJson: e.target.value })}
                        className="min-h-[180px] font-mono text-xs"
                      />
                    </div>
                  </div>
                ))
              )}

              <Button onClick={saveSteps} disabled={!selectedChapterId || saveStepsMutation.isPending}>
                <Save className="mr-2 h-4 w-4" /> Save Steps
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Chapters;
