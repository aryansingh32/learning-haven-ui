import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, Trash2 } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from 'sonner';

interface Certificate {
    id: string;
    user_name: string;
    certificate_name: string;
    issued_at: string;
    certificate_code: string;
    verify_url: string;
}

const Certificates = () => {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 500);
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['certificates', page, debouncedSearch],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '10',
                ...(debouncedSearch ? { search: debouncedSearch } : {})
            });
            const res = await api.get(`/admin/certificates?${params}`);
            return res.data as { certificates: Certificate[], total: number };
        },
    });

    const revokeMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/admin/certificates/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['certificates'] });
            toast.success('Certificate revoked successfully');
        },
        onError: () => {
            toast.error('Failed to revoke certificate');
        }
    });

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        setPage(1);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Certificates</h2>
                    <p className="text-muted-foreground">Manage user certificates and credentials.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative w-full sm:w-[250px]">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search certificates..."
                            value={search}
                            onChange={handleSearch}
                            className="pl-8 w-full"
                        />
                    </div>
                </div>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User Name</TableHead>
                            <TableHead>Certificate Name</TableHead>
                            <TableHead>Issued At</TableHead>
                            <TableHead>Certificate Code</TableHead>
                            <TableHead>Verify URL</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    <div className="flex justify-center">
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : !data || data.certificates.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    No certificates found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.certificates.map((cert) => (
                                <TableRow key={cert.id}>
                                    <TableCell className="font-medium">{cert.user_name}</TableCell>
                                    <TableCell>{cert.certificate_name}</TableCell>
                                    <TableCell>
                                        {new Date(cert.issued_at).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>{cert.certificate_code}</TableCell>
                                    <TableCell>
                                        <a href={cert.verify_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                                            Verify
                                        </a>
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => {
                                                if (window.confirm('Are you sure you want to revoke this certificate?')) {
                                                    revokeMutation.mutate(cert.id);
                                                }
                                            }}
                                            disabled={revokeMutation.isPending}
                                        >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Revoke
                                        </Button>
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
                    disabled={!data || data.certificates.length < 10 || isLoading}
                >
                    Next
                </Button>
            </div>
        </div>
    );
};

export default Certificates;
