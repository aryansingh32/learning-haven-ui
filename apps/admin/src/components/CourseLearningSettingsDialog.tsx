import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, Save, Search } from 'lucide-react';
import { toast } from 'sonner';
import { coursesService, type Course, type CourseExportType } from '../services/courses.service';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

/**
 * Course prerequisites, drip release and CSV export (slice W2-L1). The API refuses
 * prerequisite loops and unknown courses; this dialog only offers other courses.
 */
export function CourseLearningSettingsDialog({ course, courses, onClose }: {
    course: Course | null;
    courses: Course[];
    onClose: () => void;
}) {
    const qc = useQueryClient();
    const id = course?.id;
    const settings = useQuery({
        queryKey: ['course-learning-settings', id],
        queryFn: () => coursesService.getLearningSettings(id!),
        enabled: Boolean(id),
    });

    const [drip, setDrip] = useState('');
    const [prereqs, setPrereqs] = useState<string[]>([]);
    const [filter, setFilter] = useState('');
    const [exporting, setExporting] = useState<CourseExportType | null>(null);

    useEffect(() => {
        if (!settings.data) return;
        setDrip(settings.data.drip_interval_days ? String(settings.data.drip_interval_days) : '');
        setPrereqs(settings.data.prerequisites.map((p) => p.course_id));
    }, [settings.data]);

    const dripNumber = drip.trim() === '' ? null : Number(drip);
    const dripInvalid = dripNumber !== null && (!Number.isInteger(dripNumber) || dripNumber < 1 || dripNumber > 365);

    const others = useMemo(
        () => courses
            .filter((c) => c.id !== id && c.title.toLowerCase().includes(filter.trim().toLowerCase()))
            .sort((a, b) => Number(prereqs.includes(b.id)) - Number(prereqs.includes(a.id)) || a.title.localeCompare(b.title)),
        [courses, id, filter, prereqs],
    );

    const save = useMutation({
        mutationFn: () => coursesService.saveLearningSettings(id!, { drip_interval_days: dripNumber, prerequisite_ids: prereqs }),
        onSuccess: (data) => {
            qc.setQueryData(['course-learning-settings', id], data);
            toast.success('Learning settings saved');
            onClose();
        },
        onError: (e: any) => toast.error(e?.response?.data?.error || e?.message || 'Could not save'),
    });

    const download = async (type: CourseExportType) => {
        if (!id) return;
        setExporting(type);
        try {
            const blob = await coursesService.exportCourse(id, type);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${course?.title.replace(/[^a-z0-9-]+/gi, '_') || 'course'}-${type}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e: any) {
            toast.error(e?.response?.data?.error || 'Export failed');
        } finally {
            setExporting(null);
        }
    };

    const toggle = (cid: string, on: boolean) => setPrereqs((p) => (on ? [...p, cid] : p.filter((x) => x !== cid)));

    return (
        <Dialog open={Boolean(course)} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Learning settings</DialogTitle>
                    <DialogDescription>{course?.title}</DialogDescription>
                </DialogHeader>

                {settings.isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : settings.isError ? (
                    <p className="text-sm text-destructive">Could not load the settings.</p>
                ) : (
                    <div className="space-y-5">
                        <div className="space-y-1.5">
                            <Label htmlFor="drip-days">Drip release (days between chapters)</Label>
                            <Input id="drip-days" type="number" min={1} max={365} inputMode="numeric" placeholder="No drip — all chapters open"
                                value={drip} onChange={(e) => setDrip(e.target.value)} aria-invalid={dripInvalid} className="w-56" />
                            <p className="text-xs text-muted-foreground">
                                {dripInvalid ? 'Use a whole number from 1 to 365, or leave it empty.'
                                    : dripNumber ? `Chapter 2 opens ${dripNumber} days after a learner starts, chapter 3 after ${dripNumber * 2}, and so on.`
                                        : 'Leave empty to open chapters as soon as the previous one is done.'}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>Prerequisites</Label>
                            <p className="text-xs text-muted-foreground">Learners must finish every chapter of these courses before starting this one.</p>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Find a course" value={filter} onChange={(e) => setFilter(e.target.value)} className="pl-8" aria-label="Find a course" />
                            </div>
                            <ul className="max-h-56 overflow-y-auto rounded-md border divide-y" aria-label="Courses">
                                {others.length === 0 && <li className="p-3 text-sm text-muted-foreground">No other courses.</li>}
                                {others.map((c) => (
                                    <li key={c.id}>
                                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                                            <Checkbox checked={prereqs.includes(c.id)} onCheckedChange={(v) => toggle(c.id, v === true)} aria-label={`Require ${c.title}`} />
                                            <span className="min-w-0 truncate">{c.title}</span>
                                            {!c.is_published && <span className="ml-auto text-xs text-muted-foreground">draft</span>}
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="space-y-2 border-t pt-4">
                            <Label>Export</Label>
                            <p className="text-xs text-muted-foreground">CSV files in the Content Import format: edit them in a spreadsheet and import them back.</p>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" onClick={() => download('chapters_meta')} disabled={exporting !== null}>
                                    {exporting === 'chapters_meta' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                    Chapters
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => download('chapter_steps')} disabled={exporting !== null}>
                                    {exporting === 'chapter_steps' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                    Chapter steps
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={() => save.mutate()} disabled={save.isPending || dripInvalid || !settings.data}>
                        {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
