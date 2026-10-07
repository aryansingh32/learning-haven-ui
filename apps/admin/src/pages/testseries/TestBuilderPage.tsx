import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { testseriesAdminService } from '@/services/testseriesAdmin.service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, ArrowUp, ArrowDown, Trash2, Loader2, Plus, Search } from 'lucide-react';

const TestBuilderPage = () => {
    const { testId } = useParams<{ testId: string }>();
    const queryClient = useQueryClient();
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerSearch, setPickerSearch] = useState('');
    const [newSectionName, setNewSectionName] = useState('');

    const { data: test, isLoading } = useQuery({ queryKey: ['ts-test', testId], queryFn: () => testseriesAdminService.getTest(testId!), enabled: !!testId });
    const { data: pickerResults } = useQuery({
        queryKey: ['ts-questions-picker', pickerSearch],
        queryFn: () => testseriesAdminService.listQuestions({ search: pickerSearch || undefined, limit: 20 }),
        enabled: pickerOpen,
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ts-test', testId] });

    const attachMut = useMutation({
        mutationFn: (questionId: string) => testseriesAdminService.attachQuestion(testId!, questionId),
        onSuccess: () => { invalidate(); toast.success('Question attached'); },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });
    const detachMut = useMutation({
        mutationFn: (questionId: string) => testseriesAdminService.detachQuestion(testId!, questionId),
        onSuccess: () => { invalidate(); toast.success('Detached'); },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });
    const reorderMut = useMutation({
        mutationFn: (orderedIds: string[]) => testseriesAdminService.reorderQuestions(testId!, orderedIds),
        onSuccess: invalidate,
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });
    const addSectionMut = useMutation({
        mutationFn: (name: string) => testseriesAdminService.addSection(testId!, { name }),
        onSuccess: () => { invalidate(); setNewSectionName(''); },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });
    const deleteSectionMut = useMutation({
        mutationFn: testseriesAdminService.deleteSection,
        onSuccess: invalidate,
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const move = (index: number, direction: -1 | 1) => {
        if (!test) return;
        const ids = test.questions.map((q) => q.id);
        const target = index + direction;
        if (target < 0 || target >= ids.length) return;
        [ids[index], ids[target]] = [ids[target], ids[index]];
        reorderMut.mutate(ids);
    };

    if (isLoading || !test) {
        return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }

    const attachedIds = new Set(test.questions.map((q) => q.id));
    const totalMarks = test.questions.reduce((sum, q) => sum + Number(q.marks), 0);

    return (
        <div className="space-y-6">
            <Link to={test.test_series_id ? `/test-series/${test.test_series_id}/tests` : '/test-series'} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Tests
            </Link>

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{test.title}</h2>
                    <p className="text-muted-foreground mt-1">
                        {Math.round(test.duration_seconds / 60)} min · {test.questions.length} questions · {totalMarks} total marks
                        {!test.is_published && <Badge variant="destructive" className="ml-2">Draft</Badge>}
                    </p>
                </div>
                <Button onClick={() => setPickerOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Questions</Button>
            </div>

            {test.is_sectional && (
                <Card className="border-0 shadow-md">
                    <CardHeader className="pb-3"><CardTitle className="text-base">Sections</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                            {test.sections.map((s) => (
                                <Badge key={s.id} variant="outline" className="gap-2 py-1.5">
                                    {s.name}
                                    <button onClick={() => { if (confirm(`Remove section "${s.name}"?`)) deleteSectionMut.mutate(s.id); }}>
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                        <div className="flex gap-2 max-w-sm">
                            <Input placeholder="New section name" value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)} />
                            <Button size="sm" disabled={!newSectionName} onClick={() => addSectionMut.mutate(newSectionName)}>Add</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card className="border-0 shadow-md">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[60px]">#</TableHead>
                                <TableHead>Question</TableHead>
                                <TableHead className="w-[80px]">Type</TableHead>
                                <TableHead className="w-[90px]">Marks</TableHead>
                                <TableHead className="w-[120px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {test.questions.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    No questions attached yet. Click "Add Questions" to pull from the bank.
                                </TableCell></TableRow>
                            ) : (
                                test.questions.map((q, i) => (
                                    <TableRow key={q.id}>
                                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                                        <TableCell className="max-w-[420px] truncate">{q.body}</TableCell>
                                        <TableCell><Badge variant="outline" className="uppercase">{q.question_type}</Badge></TableCell>
                                        <TableCell className="text-sm">+{q.marks}{q.negative_marks > 0 ? ` / -${q.negative_marks}` : ''}</TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === test.questions.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => detachMut.mutate(q.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Add Questions from the Bank</DialogTitle></DialogHeader>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input className="pl-8" placeholder="Search question text..." value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} />
                    </div>
                    <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                        {pickerResults?.questions.map((q) => {
                            const attached = attachedIds.has(q.id);
                            return (
                                <div key={q.id} className="flex items-center justify-between gap-3 border rounded-md p-2.5">
                                    <div className="min-w-0">
                                        <p className="text-sm truncate">{q.body}</p>
                                        <p className="text-xs text-muted-foreground">{q.question_type.toUpperCase()} · {q.topic || 'untagged'} · +{q.marks}</p>
                                    </div>
                                    <Button size="sm" variant={attached ? 'secondary' : 'default'} disabled={attached || attachMut.isPending}
                                        onClick={() => attachMut.mutate(q.id)}>
                                        {attached ? 'Added' : 'Add'}
                                    </Button>
                                </div>
                            );
                        })}
                        {pickerResults && pickerResults.questions.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-6">No matching questions in the bank.</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default TestBuilderPage;
