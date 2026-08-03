import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apprenticeshipApi } from '../../services/apprenticeship.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const defaultTraditionalGuide = {
  steps: [
    {
      step_number: 1,
      title: '',
      description: '',
      code_snippets: [{ filename: '', code: '' }],
      verification_hints: '',
    },
  ],
};

const defaultAIGuide = {
  overview: '',
  recommended_prompts: [
    { phase: 'Setup', prompt: '', expected_outcome: '' },
  ],
  best_practices: [],
};

const defaultVerificationRequirements = {
  required_endpoints: [''],
  required_tests: 0,
  deployment_required: false,
  test_stages: [{ stage_number: 1, name: '', xp: 10 }],
  reviewer_instructions: '',
  sla_hours: 24,
};

type Resource = { title: string; url: string };

const ProjectEditorPage = () => {
  const { id: programId, projectId } = useParams();
  const isNew = !projectId || projectId === 'new';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<any>({
    project_number: 1,
    title: '',
    slug: '',
    description: '',
    estimated_hours: 10,
    starter_repo_url: '',
    reference_solution_url: '',
    docker_test_image: '',
    verification_mode: 'automated',
    traditional_guide: defaultTraditionalGuide,
    ai_guide: defaultAIGuide,
    helpful_resources: [] as Resource[],
    verification_requirements: defaultVerificationRequirements,
  });

  const { data: projectData, isLoading } = useQuery({
    queryKey: ['apprenticeship-project', projectId],
    queryFn: async () => {
      if (isNew) return null;
      const response = await apprenticeshipApi.getProject(projectId!);
      return response.project;
    },
    enabled: !isNew,
  });

  useEffect(() => {
    if (!projectData) return;
    setForm({
      project_number: projectData.project_number || 1,
      title: projectData.title || '',
      slug: projectData.slug || '',
      description: projectData.description || '',
      estimated_hours: projectData.estimated_hours || 10,
      starter_repo_url: projectData.starter_repo_url || '',
      reference_solution_url: projectData.reference_solution_url || '',
      docker_test_image: projectData.docker_test_image || '',
      verification_mode: projectData.verification_mode || 'automated',
      traditional_guide: projectData.traditional_guide || defaultTraditionalGuide,
      ai_guide: projectData.ai_guide || defaultAIGuide,
      helpful_resources: projectData.helpful_resources || [],
      verification_requirements: {
        ...defaultVerificationRequirements,
        ...(projectData.verification_requirements || {}),
        required_endpoints: (projectData.verification_requirements?.required_endpoints || ['']).length
          ? projectData.verification_requirements?.required_endpoints
          : [''],
        test_stages: (projectData.verification_requirements?.test_stages || [{ stage_number: 1, name: '', xp: 10 }]).length
          ? projectData.verification_requirements?.test_stages
          : [{ stage_number: 1, name: '', xp: 10 }],
      },
    });
  }, [projectData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        verification_requirements: form.verification_requirements,
      };

      if (isNew) {
        return apprenticeshipApi.createProject(programId!, payload);
      }
      return apprenticeshipApi.updateProject(projectId!, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['apprenticeship-program', programId] });
      toast.success(isNew ? 'Project created' : 'Project updated');
      navigate(`/apprenticeship/programs/${programId}/edit`);
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to save project'),
  });

  const setField = (field: string, value: any) => {
    setForm((current: any) => {
      const next = { ...current, [field]: value };
      if (field === 'title' && (!current.slug || isNew)) {
        next.slug = String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      }
      return next;
    });
  };

  const setVerificationField = (field: string, value: any) => {
    setForm((current: any) => ({
      ...current,
      verification_requirements: {
        ...current.verification_requirements,
        [field]: value,
      },
    }));
  };

  const updateStage = (index: number, field: string, value: any) => {
    setVerificationField('test_stages', (form.verification_requirements.test_stages || []).map((stage: any, i: number) =>
      i === index ? { ...stage, [field]: value } : stage
    ));
  };

  const addStage = () => {
    setVerificationField('test_stages', [
      ...(form.verification_requirements.test_stages || []),
      { stage_number: (form.verification_requirements.test_stages || []).length + 1, name: '', xp: 10 },
    ]);
  };

  const removeStage = (index: number) => {
    setVerificationField('test_stages', (form.verification_requirements.test_stages || [])
      .filter((_: any, i: number) => i !== index)
      .map((stage: any, i: number) => ({ ...stage, stage_number: i + 1 })));
  };

  const updateEndpoint = (index: number, value: string) => {
    setVerificationField('required_endpoints', (form.verification_requirements.required_endpoints || []).map((endpoint: string, i: number) =>
      i === index ? value : endpoint
    ));
  };

  const addEndpoint = () => {
    setVerificationField('required_endpoints', [...(form.verification_requirements.required_endpoints || []), '']);
  };

  const removeEndpoint = (index: number) => {
    setVerificationField('required_endpoints', (form.verification_requirements.required_endpoints || []).filter((_: string, i: number) => i !== index));
  };

  const updateStep = (index: number, field: string, value: any) => {
    const steps = [...(form.traditional_guide?.steps || [])];
    steps[index] = { ...steps[index], [field]: value };
    setField('traditional_guide', { ...form.traditional_guide, steps });
  };

  const updateStepCodeFilename = (index: number, value: string) => {
    const steps = [...(form.traditional_guide?.steps || [])];
    const snippet = steps[index].code_snippets?.[0] || { filename: '', code: '' };
    steps[index] = { ...steps[index], code_snippets: [{ ...snippet, filename: value }] };
    setField('traditional_guide', { ...form.traditional_guide, steps });
  };

  const updateStepCode = (index: number, value: string) => {
    const steps = [...(form.traditional_guide?.steps || [])];
    const snippet = steps[index].code_snippets?.[0] || { filename: '', code: '' };
    steps[index] = { ...steps[index], code_snippets: [{ ...snippet, code: value }] };
    setField('traditional_guide', { ...form.traditional_guide, steps });
  };

  const addStep = () => {
    const steps = [...(form.traditional_guide?.steps || [])];
    steps.push({
      step_number: steps.length + 1,
      title: '',
      description: '',
      code_snippets: [{ filename: '', code: '' }],
      verification_hints: '',
    });
    setField('traditional_guide', { ...form.traditional_guide, steps });
  };

  const removeStep = (index: number) => {
    const steps = (form.traditional_guide?.steps || [])
      .filter((_: any, i: number) => i !== index)
      .map((step: any, i: number) => ({ ...step, step_number: i + 1 }));
    setField('traditional_guide', { ...form.traditional_guide, steps });
  };

  const updatePrompt = (index: number, field: string, value: string) => {
    const prompts = [...(form.ai_guide?.recommended_prompts || [])];
    prompts[index] = { ...prompts[index], [field]: value };
    setField('ai_guide', { ...form.ai_guide, recommended_prompts: prompts });
  };

  const addPrompt = () => {
    setField('ai_guide', {
      ...form.ai_guide,
      recommended_prompts: [...(form.ai_guide?.recommended_prompts || []), { phase: '', prompt: '', expected_outcome: '' }],
    });
  };

  const removePrompt = (index: number) => {
    setField('ai_guide', {
      ...form.ai_guide,
      recommended_prompts: (form.ai_guide?.recommended_prompts || []).filter((_: any, i: number) => i !== index),
    });
  };

  const addResource = () => {
    setField('helpful_resources', [...form.helpful_resources, { title: '', url: '' }]);
  };

  const updateResource = (index: number, field: keyof Resource, value: string) => {
    setField('helpful_resources', form.helpful_resources.map((resource: Resource, i: number) =>
      i === index ? { ...resource, [field]: value } : resource
    ));
  };

  const removeResource = (index: number) => {
    setField('helpful_resources', form.helpful_resources.filter((_: Resource, i: number) => i !== index));
  };

  if (!isNew && isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/apprenticeship/programs/${programId}/edit`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{isNew ? 'Create Project' : 'Edit Project'}</h2>
          <p className="text-sm text-muted-foreground">Configure verification, guides, and starter resources.</p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Project Basics</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Project Number</Label>
            <Input type="number" value={form.project_number} onChange={(e) => setField('project_number', Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Estimated Hours</Label>
            <Input type="number" value={form.estimated_hours} onChange={(e) => setField('estimated_hours', Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setField('title', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input value={form.slug} onChange={(e) => setField('slug', e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setField('description', e.target.value)} className="min-h-[120px]" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Verification Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setField('verification_mode', 'automated')}
              className={`rounded-xl border p-4 text-left ${form.verification_mode === 'automated' ? 'border-primary bg-primary/5' : 'border-border'}`}
            >
              <div className="font-semibold">Fully Automated</div>
              <div className="text-sm text-muted-foreground">GitHub Webhook + Docker verification</div>
            </button>
            <button
              type="button"
              onClick={() => setField('verification_mode', 'manual')}
              className={`rounded-xl border p-4 text-left ${form.verification_mode === 'manual' ? 'border-primary bg-primary/5' : 'border-border'}`}
            >
              <div className="font-semibold">Manual Review Only</div>
              <div className="text-sm text-muted-foreground">Admin reviews each submission manually</div>
            </button>
          </div>

          {form.verification_mode === 'automated' ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Docker Test Image</Label>
                <Input value={form.docker_test_image || ''} onChange={(e) => setField('docker_test_image', e.target.value)} placeholder="learninghaven/test-project-2:latest" />
              </div>

              <div className="space-y-3">
                <div>
                  <div className="font-semibold">Test Stages</div>
                  <p className="text-sm text-muted-foreground">
                    Each stage maps to one JSON line your Docker container outputs to stdout.
                  </p>
                </div>
                {(form.verification_requirements.test_stages || []).map((stage: any, index: number) => (
                  <div key={index} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[90px_1fr_120px_40px]">
                    <Badge variant="outline" className="h-fit w-fit">#{stage.stage_number || index + 1}</Badge>
                    <Input value={stage.name} onChange={(e) => updateStage(index, 'name', e.target.value)} placeholder="Stage name, e.g. Server starts on port 3000" />
                    <Input type="number" value={stage.xp} onChange={(e) => updateStage(index, 'xp', Number(e.target.value))} placeholder="XP" />
                    <Button size="icon" variant="ghost" onClick={() => removeStage(index)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" onClick={addStage}><Plus className="mr-2 h-4 w-4" /> Add Stage</Button>
              </div>

              <div className="space-y-3">
                <div className="font-semibold">Required Endpoints</div>
                {(form.verification_requirements.required_endpoints || []).map((endpoint: string, index: number) => (
                  <div key={index} className="flex gap-2">
                    <Input value={endpoint} onChange={(e) => updateEndpoint(index, e.target.value)} placeholder="POST /api/auth/signup" />
                    <Button size="icon" variant="ghost" onClick={() => removeEndpoint(index)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" onClick={addEndpoint}><Plus className="mr-2 h-4 w-4" /> Add Endpoint</Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Reviewer Instructions</Label>
                <Textarea
                  value={form.verification_requirements.reviewer_instructions || ''}
                  onChange={(e) => setVerificationField('reviewer_instructions', e.target.value)}
                  className="min-h-[140px]"
                  placeholder="What should the reviewer check for?"
                />
              </div>
              <div className="space-y-2">
                <Label>SLA Hours</Label>
                <Input
                  type="number"
                  value={form.verification_requirements.sla_hours || 24}
                  onChange={(e) => setVerificationField('sla_hours', Number(e.target.value))}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Traditional Path Guide</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {(form.traditional_guide?.steps || []).map((step: any, index: number) => (
            <div key={index} className="space-y-3 rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline">Step {step.step_number}</Badge>
                <Button size="icon" variant="ghost" onClick={() => removeStep(index)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <Input value={step.title} onChange={(e) => updateStep(index, 'title', e.target.value)} placeholder="Step title" />
              <Textarea value={step.description} onChange={(e) => updateStep(index, 'description', e.target.value)} className="min-h-[100px]" placeholder="Step description (markdown supported)" />
              <div className="space-y-2 rounded-xl border bg-muted/20 p-4">
                <Label>Code Snippet (optional)</Label>
                <Input value={step.code_snippets?.[0]?.filename || ''} onChange={(e) => updateStepCodeFilename(index, e.target.value)} placeholder="filename.js" />
                <textarea
                  value={step.code_snippets?.[0]?.code || ''}
                  onChange={(e) => updateStepCode(index, e.target.value)}
                  className="min-h-[120px] w-full rounded-lg border bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100"
                  placeholder="// code here"
                />
              </div>
              <Input value={step.verification_hints || ''} onChange={(e) => updateStep(index, 'verification_hints', e.target.value)} placeholder="Hint: Your server should respond on port 3000" />
            </div>
          ))}
          <Button variant="outline" onClick={addStep}><Plus className="mr-2 h-4 w-4" /> Add Step</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>AI-Assisted Path Guide</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Textarea value={form.ai_guide?.overview || ''} onChange={(e) => setField('ai_guide', { ...form.ai_guide, overview: e.target.value })} placeholder="Overview shown above the prompt cards" className="min-h-[100px]" />
          {(form.ai_guide?.recommended_prompts || []).map((prompt: any, index: number) => (
            <div key={index} className="space-y-3 rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <Input value={prompt.phase} onChange={(e) => updatePrompt(index, 'phase', e.target.value)} placeholder="Phase (e.g. Setup, Core Feature, Testing)" className="max-w-[220px]" />
                <Button size="icon" variant="ghost" onClick={() => removePrompt(index)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <Textarea value={prompt.prompt} onChange={(e) => updatePrompt(index, 'prompt', e.target.value)} className="min-h-[100px]" placeholder="The prompt students will copy into Cursor/ChatGPT" />
              <Input value={prompt.expected_outcome} onChange={(e) => updatePrompt(index, 'expected_outcome', e.target.value)} placeholder="Expected outcome" />
            </div>
          ))}
          <Button variant="outline" onClick={addPrompt}><Plus className="mr-2 h-4 w-4" /> Add Prompt Card</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Resources</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Starter Repo URL</Label>
              <Input value={form.starter_repo_url} onChange={(e) => setField('starter_repo_url', e.target.value)} placeholder="https://github.com/..." />
            </div>
            <div className="space-y-2">
              <Label>Reference Solution URL</Label>
              <Input value={form.reference_solution_url} onChange={(e) => setField('reference_solution_url', e.target.value)} placeholder="https://github.com/... (hidden until pass)" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Helpful Resources</div>
              <Button variant="outline" onClick={addResource}><Plus className="mr-2 h-4 w-4" /> Add Resource</Button>
            </div>
            {form.helpful_resources.map((resource: Resource, index: number) => (
              <div key={index} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[220px_1fr_40px]">
                <Input value={resource.title} onChange={(e) => updateResource(index, 'title', e.target.value)} placeholder="Title" />
                <Input value={resource.url} onChange={(e) => updateResource(index, 'url', e.target.value)} placeholder="URL" />
                <Button size="icon" variant="ghost" onClick={() => removeResource(index)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectEditorPage;
