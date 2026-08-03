import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apprenticeshipApi } from '../../services/apprenticeship.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Loader2, Save, GripVertical, Pencil } from 'lucide-react';
import { toast } from 'sonner';

interface ProgramForm {
  title: string;
  slug: string;
  description: string;
  duration_days: number;
  price_inr: number;
  original_price_inr: number;
  tech_stack: string;
  difficulty_level: string;
  max_enrollments: number;
  status: string;
  learning_paths: string[];
}

const defaultForm: ProgramForm = {
  title: '',
  slug: '',
  description: '',
  duration_days: 90,
  price_inr: 0,
  original_price_inr: 0,
  tech_stack: '',
  difficulty_level: 'beginner',
  max_enrollments: 0,
  status: 'draft',
  learning_paths: ['traditional', 'ai_assisted'],
};

const ProgramEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !id || id === 'new';
  const [form, setForm] = useState<ProgramForm>(defaultForm);

  const { data: programData, isLoading } = useQuery({
    queryKey: ['apprenticeship-program', id],
    queryFn: async () => {
      if (isNew) return null;
      const res = await apprenticeshipApi.getProgram(id!);
      return res.program;
    },
    enabled: !isNew,
  });

  useEffect(() => {
    if (programData) {
      setForm({
        title: programData.title || '',
        slug: programData.slug || '',
        description: programData.description || '',
        duration_days: programData.duration_days || 90,
        price_inr: programData.price_inr || 0,
        original_price_inr: programData.original_price_inr || 0,
        tech_stack: (programData.tech_stack || []).join(', '),
        difficulty_level: programData.difficulty_level || 'beginner',
        max_enrollments: programData.max_enrollments || 0,
        status: programData.status || 'draft',
        learning_paths: programData.learning_paths || ['traditional', 'ai_assisted'],
      });
    }
  }, [programData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        slug: form.slug,
        description: form.description,
        duration_days: form.duration_days,
        price_inr: form.price_inr,
        original_price_inr: form.original_price_inr || undefined,
        tech_stack: form.tech_stack.split(',').map(s => s.trim()).filter(Boolean),
        difficulty_level: form.difficulty_level,
        max_enrollments: form.max_enrollments || undefined,
        status: form.status,
        learning_paths: form.learning_paths,
      };

      if (isNew) {
        return apprenticeshipApi.createProgram(payload);
      } else {
        return apprenticeshipApi.updateProgram(id!, payload);
      }
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['apprenticeship-programs'] });
      toast.success(isNew ? 'Program created!' : 'Program updated!');
      if (isNew) {
        navigate(`/apprenticeship/programs/${res.program.id}/edit`);
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to save program');
    },
  });

  const autoSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const updateField = (field: keyof ProgramForm, value: any) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'title' && (isNew || !prev.slug)) {
        updated.slug = autoSlug(value);
      }
      return updated;
    });
  };

  if (!isNew && isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/apprenticeship/programs')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{isNew ? 'Create Program' : 'Edit Program'}</h2>
          <p className="text-muted-foreground text-sm">
            {isNew ? 'Set up a new apprenticeship program.' : `Editing: ${programData?.title}`}
          </p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {isNew ? 'Create' : 'Save Changes'}
        </Button>
      </div>

      {/* Program Details Form */}
      <div className="border rounded-lg p-6 space-y-4">
        <h3 className="font-semibold text-lg">Program Details</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" value={form.title} onChange={e => updateField('title', e.target.value)} placeholder="Full-Stack Web Development" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug *</Label>
            <Input id="slug" value={form.slug} onChange={e => updateField('slug', e.target.value)} placeholder="full-stack-web-dev" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={form.description}
            onChange={e => updateField('description', e.target.value)}
            placeholder="Build 5 production-grade projects..."
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="difficulty">Difficulty Level *</Label>
            <Select value={form.difficulty_level} onValueChange={v => updateField('difficulty_level', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (days) *</Label>
            <Input id="duration" type="number" value={form.duration_days} onChange={e => updateField('duration_days', Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={form.status} onValueChange={v => updateField('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="price">Price (paise) *</Label>
            <Input id="price" type="number" value={form.price_inr} onChange={e => updateField('price_inr', Number(e.target.value))} />
            <p className="text-xs text-muted-foreground">₹{(form.price_inr / 100).toFixed(2)}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="original_price">Original Price (paise)</Label>
            <Input id="original_price" type="number" value={form.original_price_inr} onChange={e => updateField('original_price_inr', Number(e.target.value))} />
            {form.original_price_inr > 0 && <p className="text-xs text-muted-foreground">₹{(form.original_price_inr / 100).toFixed(2)}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="max_enrollments">Max Enrollments</Label>
            <Input id="max_enrollments" type="number" value={form.max_enrollments} onChange={e => updateField('max_enrollments', Number(e.target.value))} placeholder="0 = unlimited" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tech_stack">Tech Stack (comma separated)</Label>
          <Input id="tech_stack" value={form.tech_stack} onChange={e => updateField('tech_stack', e.target.value)} placeholder="React, Node.js, PostgreSQL, Docker" />
          {form.tech_stack && (
            <div className="flex gap-1 flex-wrap">
              {form.tech_stack.split(',').map(s => s.trim()).filter(Boolean).map(tech => (
                <Badge key={tech} variant="secondary" className="text-xs">{tech}</Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Projects Section — only if editing existing program */}
      {!isNew && programData?.projects && (
        <div className="border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Projects ({programData.projects.length})</h3>
            <Button size="sm" onClick={() => navigate(`/apprenticeship/programs/${id}/projects/new`)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Project
            </Button>
          </div>

          {programData.projects.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">
              No projects yet. Add your first project.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {programData.projects.map((project: any) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                        <span className="font-mono text-sm">{project.project_number}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{project.title}</div>
                      <div className="text-xs text-muted-foreground">/{project.slug}</div>
                    </TableCell>
                    <TableCell>{project.estimated_hours || '—'} hrs</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {project.verification_mode}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={project.is_active ? 'default' : 'secondary'} className="text-xs">
                        {project.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => navigate(`/apprenticeship/programs/${id}/projects/${project.id}/edit`)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
};

export default ProgramEditorPage;
