import { useState, useEffect } from "react";
import { X, Save, Clock, AlertTriangle, BookOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useApiMutation, useApiQuery } from "@/hooks/useApi";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface NotesModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    problemId: string;
    problemTitle: string;
}

export function NotesModal({ open, onOpenChange, problemId, problemTitle }: NotesModalProps) {
    const [activeTab, setActiveTab] = useState("notes");
    const [content, setContent] = useState("");
    const [patternNotes, setPatternNotes] = useState("");
    const [mistakeLog, setMistakeLog] = useState({ mistake: "", why: "", pattern: "" });

    // Fetch existing notes
    const { data: notes, isLoading } = useApiQuery<any>(
        ['notes', problemId],
        `/notes/${problemId}`,
        { enabled: open }
    );

    // Update local state when data loads
    useEffect(() => {
        if (notes) {
            setContent(notes.content || "");
            setPatternNotes(notes.pattern_notes || "");
            setMistakeLog(notes.mistake_log || { mistake: "", why: "", pattern: "" });
        }
    }, [notes]);

    // Save mutation
    const { mutate: saveNotes, isPending: isSaving } = useApiMutation(
        `/notes/${problemId}`,
        'POST',
        {
            onSuccess: () => {
                toast.success("Notes saved successfully");
            },
            onError: (err) => {
                toast.error("Failed to save notes");
            }
        }
    );

    const handleSave = () => {
        saveNotes({
            content,
            pattern_notes: patternNotes,
            mistake_log: mistakeLog
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        Notes: {problemTitle}
                    </DialogTitle>
                </DialogHeader>

                {isLoading ? (
                    <div className="space-y-4 py-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-32 w-full" />
                    </div>
                ) : (
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="notes">Quick Notes</TabsTrigger>
                            <TabsTrigger value="patterns">Patterns</TabsTrigger>
                            <TabsTrigger value="mistakes" className="text-destructive data-[state=active]:text-destructive">Mistake Log</TabsTrigger>
                        </TabsList>

                        <div className="mt-4 space-y-4">
                            <TabsContent value="notes" className="space-y-3">
                                <p className="text-sm text-muted-foreground">
                                    Write down your thoughts, approach, or key takeaways. Supports Markdown.
                                </p>
                                <Textarea
                                    placeholder="e.g. Use a hash map to track frequencies..."
                                    className="min-h-[200px] font-mono text-sm"
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                />
                            </TabsContent>

                            <TabsContent value="patterns" className="space-y-3">
                                <p className="text-sm text-muted-foreground">
                                    Identify patterns that solve this problem (e.g., Two Pointers, Sliding Window).
                                </p>
                                <Textarea
                                    placeholder="e.g. This is a classic Sliding Window problem because..."
                                    className="min-h-[200px]"
                                    value={patternNotes}
                                    onChange={(e) => setPatternNotes(e.target.value)}
                                />
                            </TabsContent>

                            <TabsContent value="mistakes" className="space-y-4">
                                <div className="bg-destructive/10 p-4 rounded-xl border border-destructive/20">
                                    <h4 className="flex items-center gap-2 text-destructive font-semibold mb-2">
                                        <AlertTriangle className="h-4 w-4" /> Why did you fail?
                                    </h4>
                                    <p className="text-xs text-muted-foreground mb-4">
                                        Documenting mistakes improves retention by 50%. Be honest.
                                    </p>

                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-medium block mb-1.5">What was the mistake?</label>
                                            <Textarea
                                                placeholder="e.g. Index out of bounds error"
                                                className="h-20 resize-none"
                                                value={mistakeLog.mistake}
                                                onChange={(e) => setMistakeLog({ ...mistakeLog, mistake: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium block mb-1.5">Why did it happen?</label>
                                            <Textarea
                                                placeholder="e.g. Forgot to handle the edge case where array is empty"
                                                className="h-20 resize-none"
                                                value={mistakeLog.why}
                                                onChange={(e) => setMistakeLog({ ...mistakeLog, why: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium block mb-1.5">What pattern did I miss?</label>
                                            <Textarea
                                                placeholder="e.g. Boundary checks"
                                                className="h-20 resize-none"
                                                value={mistakeLog.pattern}
                                                onChange={(e) => setMistakeLog({ ...mistakeLog, pattern: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>
                )}

                <DialogFooter className="mt-6 flex flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving} className="gradient-golden text-primary-foreground">
                        {isSaving ? (
                            <>
                                <Clock className="mr-2 h-4 w-4 animate-spin" /> Saving...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" /> Save Notes
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
