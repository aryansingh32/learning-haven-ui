import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { testseriesAdminService, type BankQuestion } from '@/services/testseriesAdmin.service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Loader2, Search } from 'lucide-react';

const OPTION_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;
type Letter = (typeof OPTION_LETTERS)[number];

interface QuestionForm {
    questionType: 'mcq' | 'msq' | 'nat';
    body: string;
    options: Record<Letter, string>;
    correctLetters: Letter[];
    natAnswer: string;
    natTolerance: string;
    marks: string;
    negativeMarks: string;
    topic: string;
    difficulty: '' | 'easy' | 'medium' | 'hard';
    explanation: string;
}

const emptyForm: QuestionForm = {
    questionType: 'mcq',
    body: '',
    options: { a: '', b: '', c: '', d: '', e: '', f: '' },
    correctLetters: [],
    natAnswer: '',
    natTolerance: '0',
    marks: '1',
    negativeMarks: '0',
    topic: '',
    difficulty: '',
    explanation: '',
};

function toForm(q: BankQuestion): QuestionForm {
    const options: Record<Letter, string> = { a: '', b: '', c: '', d: '', e: '', f: '' };
    (q.options || []).forEach((o) => { if (OPTION_LETTERS.includes(o.id as Letter)) options[o.id as Letter] = o.text; });
    return {
        questionType: q.question_type,
        body: q.body,
        options,
        correctLetters: (q.correct_options || []) as Letter[],
        natAnswer: q.nat_answer !== null ? String(q.nat_answer) : '',
        natTolerance: String(q.nat_tolerance ?? 0),
        marks: String(q.marks),
        negativeMarks: String(q.negative_marks),
        topic: q.topic || '',
        difficulty: q.difficulty || '',
        explanation: q.explanation || '',
    };
}

function toPayload(form: QuestionForm) {
    const options = OPTION_LETTERS
        .filter((l) => form.options[l].trim().length > 0)
        .map((l) => ({ id: l, text: form.options[l].trim() }));
    return {
        questionType: form.questionType,
        body: form.body,
        options: form.questionType === 'nat' ? undefined : options,
        correctOptions: form.questionType === 'nat' ? undefined : form.correctLetters,
        natAnswer: form.questionType === 'nat' ? Number(form.natAnswer) : undefined,
        natTolerance: form.questionType === 'nat' ? Number(form.natTolerance || 0) : undefined,
        marks: Number(form.marks || 1),
        negativeMarks: Number(form.negativeMarks || 0),
        topic: form.topic || undefined,
        difficulty: form.difficulty || undefined,
        explanation: form.explanation || undefined,
    };
}

const QuestionEditor = ({ form, setForm }: { form: QuestionForm; setForm: (f: QuestionForm) => void }) => {
    const toggleCorrect = (letter: Letter) => {
        if (form.questionType === 'mcq') {
            setForm({ ...form, correctLetters: [letter] });
        } else {
            const has = form.correctLetters.includes(letter);
            setForm({ ...form, correctLetters: has ? form.correctLetters.filter((l) => l !== letter) : [...form.correctLetters, letter] });
        }
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                    <Label className="text-xs">Question Type</Label>
                    <Select value={form.questionType} onValueChange={(v) => setForm({ ...form, questionType: v as any, correctLetters: [] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="mcq">MCQ (single correct)</SelectItem>
                            <SelectItem value="msq">MSQ (multi correct)</SelectItem>
                            <SelectItem value="nat">NAT (numeric answer)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs">Topic</Label>
                    <Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="Algorithms" />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs">Difficulty</Label>
                    <Select value={form.difficulty || 'none'} onValueChange={(v) => setForm({ ...form, difficulty: v === 'none' ? '' : (v as any) })}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs">Question Body</Label>
                <Textarea rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="What is the time complexity of ...?" />
            </div>

            {form.questionType === 'nat' ? (
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-xs">Correct Numeric Answer</Label>
                        <Input type="number" value={form.natAnswer} onChange={(e) => setForm({ ...form, natAnswer: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs">Tolerance (± range accepted)</Label>
                        <Input type="number" value={form.natTolerance} onChange={(e) => setForm({ ...form, natTolerance: e.target.value })} />
                    </div>
                </div>
            ) : (
                <div className="space-y-2">
                    <Label className="text-xs">
                        Options — check the correct one{form.questionType === 'msq' ? '(s)' : ''}. Leave unused letters blank.
                    </Label>
                    {OPTION_LETTERS.map((letter) => (
                        <div key={letter} className="flex items-center gap-2">
                            <Checkbox checked={form.correctLetters.includes(letter)} onCheckedChange={() => toggleCorrect(letter)} />
                            <span className="text-xs w-4 uppercase text-muted-foreground">{letter}</span>
                            <Input value={form.options[letter]} onChange={(e) => setForm({ ...form, options: { ...form.options, [letter]: e.target.value } })} placeholder={`Option ${letter.toUpperCase()}`} />
                        </div>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label className="text-xs">Marks (correct)</Label>
                    <Input type="number" step="0.01" value={form.marks} onChange={(e) => setForm({ ...form, marks: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs">Negative Marks (wrong, MCQ only — subtracted)</Label>
                    <Input type="number" step="0.01" value={form.negativeMarks} onChange={(e) => setForm({ ...form, negativeMarks: e.target.value })} disabled={form.questionType !== 'mcq'} />
                </div>
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs">Explanation (shown after submission)</Label>
                <Textarea rows={2} value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
            </div>
        </div>
    );
};

const QuestionBankPage = () => {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [topicFilter, setTopicFilter] = useState('all');
    const [difficultyFilter, setDifficultyFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [editing, setEditing] = useState<BankQuestion | null>(null);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState<QuestionForm>(emptyForm);

    useEffect(() => {
        const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
        return () => clearTimeout(t);
    }, [search]);

    const { data: topics } = useQuery({ queryKey: ['ts-topics'], queryFn: testseriesAdminService.listTopics });
    const { data, isLoading } = useQuery({
        queryKey: ['ts-questions', debouncedSearch, topicFilter, difficultyFilter, typeFilter, page],
        queryFn: () => testseriesAdminService.listQuestions({
            search: debouncedSearch || undefined,
            topic: topicFilter === 'all' ? undefined : topicFilter,
            difficulty: difficultyFilter === 'all' ? undefined : difficultyFilter,
            question_type: typeFilter === 'all' ? undefined : typeFilter,
            page,
        }),
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ts-questions'] });

    const createMut = useMutation({
        mutationFn: testseriesAdminService.createQuestion,
        onSuccess: () => { invalidate(); toast.success('Question created'); setCreating(false); setForm(emptyForm); },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });
    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => testseriesAdminService.updateQuestion(id, data),
        onSuccess: () => { invalidate(); toast.success('Updated'); setEditing(null); },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });
    const deleteMut = useMutation({
        mutationFn: testseriesAdminService.deleteQuestion,
        onSuccess: () => { invalidate(); toast.success('Deleted'); },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Question Bank</h2>
                    <p className="text-muted-foreground mt-1">
                        Every question across every exam. Bulk-import via CSV/Google Sheet from{' '}
                        <a href="/content-import" className="text-primary hover:underline">Content Import</a>, or add one manually here.
                    </p>
                </div>
                <Button onClick={() => { setCreating(true); setForm(emptyForm); }}><Plus className="mr-2 h-4 w-4" /> New Question</Button>
            </div>

            <div className="flex flex-wrap gap-3">
                <div className="relative w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-8" placeholder="Search question text..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <Select value={topicFilter} onValueChange={setTopicFilter}>
                    <SelectTrigger className="w-44"><SelectValue placeholder="Topic" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All topics</SelectItem>
                        {topics?.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Difficulty" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All difficulties</SelectItem>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-36"><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        <SelectItem value="mcq">MCQ</SelectItem>
                        <SelectItem value="msq">MSQ</SelectItem>
                        <SelectItem value="nat">NAT</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Card className="border-0 shadow-md">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Question</TableHead>
                                <TableHead className="w-[80px]">Type</TableHead>
                                <TableHead>Topic</TableHead>
                                <TableHead>Difficulty</TableHead>
                                <TableHead>Marks</TableHead>
                                <TableHead className="w-[100px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                            ) : !data?.questions.length ? (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No questions found.</TableCell></TableRow>
                            ) : (
                                data.questions.map((q) => (
                                    <TableRow key={q.id} className="group">
                                        <TableCell className="max-w-[420px] truncate">{q.body}</TableCell>
                                        <TableCell><Badge variant="outline" className="uppercase">{q.question_type}</Badge></TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{q.topic || '—'}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground capitalize">{q.difficulty || '—'}</TableCell>
                                        <TableCell className="text-sm">+{q.marks}{q.negative_marks > 0 ? ` / -${q.negative_marks}` : ''}</TableCell>
                                        <TableCell>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(q); setForm(toForm(q)); }}><Pencil className="h-3.5 w-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                                    onClick={() => { if (confirm('Delete this question? This also removes it from any test it is attached to.')) deleteMut.mutate(q.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {data && data.pagination.totalPages > 1 && (
                <div className="flex justify-center gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                    <span className="text-sm text-muted-foreground self-center">Page {data.pagination.page} of {data.pagination.totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
            )}

            <Dialog open={creating || !!editing} onOpenChange={(open) => { if (!open) { setCreating(false); setEditing(null); } }}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>{editing ? 'Edit Question' : 'New Question'}</DialogTitle></DialogHeader>
                    <QuestionEditor form={form} setForm={setForm} />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</Button>
                        <Button
                            disabled={!form.body || createMut.isPending || updateMut.isPending}
                            onClick={() => editing ? updateMut.mutate({ id: editing.id, data: toPayload(form) }) : createMut.mutate(toPayload(form))}
                        >
                            {editing ? 'Save Changes' : 'Create Question'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default QuestionBankPage;
