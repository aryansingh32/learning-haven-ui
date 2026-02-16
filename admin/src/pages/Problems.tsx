import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { problemsService } from '../services/problems.service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Search, Loader2, Plus } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { useNavigate } from 'react-router-dom';

const Problems = () => {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 500);
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { data, isLoading } = useQuery({
        queryKey: ['problems', page, debouncedSearch],
        queryFn: () => problemsService.listProblems(page, 10, debouncedSearch),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => problemsService.deleteProblem(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['problems'] });
        },
    });

    const importMutation = useMutation({
        mutationFn: (url: string) => problemsService.importProblems(url),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['problems'] });
            alert(`Import complete! Imported: ${data.imported}, Skipped: ${data.skipped}`);
        },
        onError: (err: any) => {
            alert(`Import failed: ${err.response?.data?.error || err.message}`);
        }
    });

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        setPage(1);
    };

    const handleBulkImport = () => {
        const url = prompt("Enter Google Sheets Public CSV Export URL:");
        if (url) {
            importMutation.mutate(url);
        }
    };

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty) {
            case 'Easy': return 'bg-green-100 text-green-800 hover:bg-green-100';
            case 'Medium': return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100';
            case 'Hard': return 'bg-red-100 text-red-800 hover:bg-red-100';
            default: return 'secondary';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Problems</h2>
                    <p className="text-muted-foreground">Manage coding problems and challenges.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleBulkImport} disabled={importMutation.isPending}>
                        {importMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="mr-2 h-4 w-4" />}
                        Bulk Import
                    </Button>
                    <Button onClick={() => navigate('/problems/new')}>
                        <Plus className="mr-2 h-4 w-4" />
                        New Problem
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search problems..."
                        value={search}
                        onChange={handleSearch}
                        className="pl-8 w-[250px]"
                    />
                </div>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Difficulty</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Premium</TableHead>
                            <TableHead className="w-[80px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    <div className="flex justify-center">
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : data?.problems.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    No problems found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            data?.problems.map((problem) => (
                                <TableRow key={problem.id}>
                                    <TableCell>
                                        <div className="font-medium">{problem.title}</div>
                                        <div className="text-xs text-muted-foreground">/{problem.slug}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={getDifficultyColor(problem.difficulty)} variant="outline">
                                            {problem.difficulty}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{/* Need category name, but API listing might not have it populated or it's an ID */}
                                        {problem.category_id}
                                    </TableCell>
                                    <TableCell>
                                        {problem.is_premium ? (
                                            <Badge variant="default" className="bg-purple-100 text-purple-800 hover:bg-purple-100">Premium</Badge>
                                        ) : (
                                            <Badge variant="outline">Free</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => navigate(`/problems/${problem.id}`)}>
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={() => {
                                                        if (confirm('Are you sure you want to delete this problem?')) {
                                                            deleteMutation.mutate(problem.id);
                                                        }
                                                    }}
                                                >
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-end space-x-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || isLoading}
                >
                    Previous
                </Button>
                <div className="text-sm font-medium">Page {page}</div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!data || data.problems.length < 10 || isLoading}
                >
                    Next
                </Button>
            </div>
        </div>
    );
};

export default Problems;
