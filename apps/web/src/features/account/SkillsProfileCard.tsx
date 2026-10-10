import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Award, Code2, Hammer, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LEVELS, accountApi, type Skill, type SkillCategory, type SkillLevel } from './account.service';

const CATEGORIES: Array<{ value: SkillCategory | ''; label: string }> = [
  { value: '', label: 'No category' },
  { value: 'language', label: 'Language' },
  { value: 'framework', label: 'Framework' },
  { value: 'tool', label: 'Tool' },
  { value: 'concept', label: 'Concept' },
  { value: 'soft', label: 'Soft skill' },
];
const selectCls = 'h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground';
const same = (a: Skill[], b: Skill[]) => JSON.stringify(a) === JSON.stringify(b);

/** Skills profile on the Profile page (slice W2-A1): what you say you know, and what your work on Forge shows. */
export function SkillsProfileCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['skills-profile'], queryFn: accountApi.skills, retry: false });
  const [draft, setDraft] = useState<Skill[]>([]);
  const [name, setName] = useState('');
  const [level, setLevel] = useState<SkillLevel>('intermediate');
  const [category, setCategory] = useState<SkillCategory | ''>('');
  useEffect(() => { if (q.data) setDraft(q.data.skills); }, [q.data]);
  const save = useMutation({
    mutationFn: accountApi.saveSkills,
    onSuccess: (data) => { qc.setQueryData(['skills-profile'], data); toast.success('Skills saved'); },
    onError: (e: Error) => toast.error(e.message),
  });
  const dirty = q.data ? !same(draft, q.data.skills) : false;
  const names = useMemo(() => new Set(draft.map((s) => s.name.toLowerCase())), [draft]);
  const trimmed = name.replace(/\s+/g, ' ').trim();
  const nameProblem = !trimmed ? null : trimmed.length > 40 ? 'Up to 40 characters.' : /[<>{}]/.test(trimmed) ? 'No < > { } characters.' : names.has(trimmed.toLowerCase()) ? 'Already on your list.' : null;
  const full = draft.length >= 30;

  const add = (skill: Skill) => setDraft((d) => (d.some((s) => s.name.toLowerCase() === skill.name.toLowerCase()) || d.length >= 30 ? d : [...d, skill]));
  const evidence = q.data?.evidence ?? [];
  const practice = evidence.filter((e) => e.source === 'practice');
  const certs = evidence.filter((e) => e.source === 'certificate');
  const projects = evidence.filter((e) => e.source === 'project');

  return (
    <section className="card-glass rounded-2xl p-5 sm:p-6 space-y-4" aria-labelledby="skills-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="skills-h" className="font-display font-bold text-foreground flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Skills profile</h2>
        {dirty && (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => q.data && setDraft(q.data.skills)}>Undo</Button>
            <Button size="sm" onClick={() => save.mutate(draft)} disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save skills
            </Button>
          </div>
        )}
      </div>
      {q.isLoading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
      {q.isError && <p className="text-sm text-muted-foreground">Your skills can't be loaded right now.</p>}
      {q.data && (
        <>
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Your skills</h3>
            {draft.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add the languages, frameworks and tools you know, and how well.</p>
            ) : (
              <ul className="space-y-2" aria-label="Your skills">
                {draft.map((s, i) => (
                  <li key={s.name} className="flex flex-wrap items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2">
                    <span className="min-w-0 flex-1 text-sm font-medium text-foreground break-words">{s.name}</span>
                    <select aria-label={`Level for ${s.name}`} className={selectCls} value={s.level}
                      onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, level: e.target.value as SkillLevel } : x)))}>
                      {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                    <button type="button" aria-label={`Remove ${s.name}`} className="rounded p-1 text-muted-foreground hover:text-destructive"
                      onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}>
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (!trimmed || nameProblem || full) return;
              add({ name: trimmed, level, category: category || null });
              setName('');
            }}>
            <div className="space-y-1">
              <Label htmlFor="skill-name">Add a skill</Label>
              <Input id="skill-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Java, React, SQL" maxLength={60}
                aria-invalid={Boolean(nameProblem)} aria-describedby="skill-name-hint" />
            </div>
            <select aria-label="Level" className={selectCls} value={level} onChange={(e) => setLevel(e.target.value as SkillLevel)}>
              {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <select aria-label="Category" className={selectCls} value={category} onChange={(e) => setCategory(e.target.value as SkillCategory | '')}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <Button type="submit" size="sm" variant="outline" disabled={!trimmed || Boolean(nameProblem) || full}><Plus className="mr-1 h-4 w-4" /> Add</Button>
            <p id="skill-name-hint" className={nameProblem ? 'text-xs text-destructive sm:col-span-4' : 'text-xs text-muted-foreground sm:col-span-4'}>
              {nameProblem ?? (full ? 'You have the maximum of 30 skills.' : `${draft.length} of 30. Remember to save.`)}
            </p>
          </form>

          {q.data.suggestions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">From your resume</h3>
              <div className="flex flex-wrap gap-2">
                {q.data.suggestions.filter((s) => !names.has(s.name.toLowerCase())).map((s) => (
                  <button key={s.name} type="button" disabled={full} onClick={() => add({ name: s.name, level: 'intermediate', category: s.category })}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-50"
                    aria-label={`Add ${s.name} from your resume`}>
                    <Plus className="h-3 w-3" /> {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-1">Shown by your work on Forge</h3>
            <p className="text-xs text-muted-foreground mb-2">Problems the judge accepted, certificates you earned and projects you finished.</p>
            {evidence.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet — solve problems, finish a project or earn a certificate and it shows up here.</p>
            ) : (
              <ul className="flex flex-wrap gap-2" aria-label="Skills shown by your work">
                {practice.map((e) => (
                  <li key={`p-${e.skill}`} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs text-foreground">
                    <Code2 className="h-3 w-3 text-primary" aria-hidden /> {e.skill} · {e.amount} solved
                  </li>
                ))}
                {certs.map((e) => (
                  <li key={`c-${e.skill}-${e.amount}`} className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-xs text-foreground">
                    <Award className="h-3 w-3 text-amber-600" aria-hidden /> {e.skill} · certificate
                  </li>
                ))}
                {projects.map((e, i) => (
                  <li key={`b-${e.skill}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-foreground">
                    <Hammer className="h-3 w-3 text-emerald-600" aria-hidden /> {e.skill}{e.detail ? ` · ${e.detail}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
