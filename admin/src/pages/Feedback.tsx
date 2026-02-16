import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { feedbackService } from '../services/feedback.service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
    reviewed: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    resolved: 'bg-green-100 text-green-800 hover:bg-green-100',
    dismissed: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
};

const Feedback = () => {
    const [page, setPage] = useState(1);
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['admin-feedback', page],
        queryFn: () => feedbackService.list(page, 20),
    });

    const updateMut = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) => feedbackService.updateStatus(id, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-feedback'] });
            toast.success('Feedback status updated');
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    const feedbackList = Array.isArray(data) ? data : data?.feedback ?? data?.data ?? [];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Feedback</h2>
                <p className="text-muted-foreground mt-1">Review and manage user feedback submissions</p>
            </div>

            <Card className="border-0 shadow-md">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Message</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="w-[140px]">Update</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                            ) : !feedbackList.length ? (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    <MessageSquare className="mx-auto h-8 w-8 mb-2 opacity-30" />
                                    No feedback yet
                                </TableCell></TableRow>
                            ) : (
                                feedbackList.map((fb: any) => (
                                    <TableRow key={fb.id} className="group">
                                        <TableCell>
                                            <div>
                                                <p className="text-sm font-medium">{fb.user?.full_name || fb.user_id?.slice(0, 8)}</p>
                                                <p className="text-xs text-muted-foreground">{fb.user?.email || ''}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell><Badge variant="outline">{fb.type || 'general'}</Badge></TableCell>
                                        <TableCell className="max-w-[300px] truncate text-sm">{fb.message}</TableCell>
                                        <TableCell>
                                            <Badge className={statusColors[fb.status] || ''} variant="outline">
                                                {fb.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{new Date(fb.created_at).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            <Select
                                                value={fb.status}
                                                onValueChange={(val) => updateMut.mutate({ id: fb.id, status: val })}
                                            >
                                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="pending">Pending</SelectItem>
                                                    <SelectItem value="reviewed">Reviewed</SelectItem>
                                                    <SelectItem value="resolved">Resolved</SelectItem>
                                                    <SelectItem value="dismissed">Dismissed</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <div className="flex items-center justify-end space-x-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                <div className="text-sm font-medium">Page {page}</div>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={!feedbackList.length || feedbackList.length < 20}>Next</Button>
            </div>
        </div>
    );
};

export default Feedback;
