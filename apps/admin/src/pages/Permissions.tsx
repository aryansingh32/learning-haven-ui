import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Shield, Plus, Lock, Unlock, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { toast } from 'sonner';

export default function Permissions() {
    const [search, setSearch] = useState('');
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const { data: roles = [], isLoading: isLoadingRoles } = useQuery({
        queryKey: ['admin-roles'],
        queryFn: async () => {
            const { data } = await api.get('/admin/roles');
            return data;
        }
    });

    const { data: permissions = [], isLoading: isLoadingPermissions } = useQuery({
        queryKey: ['admin-permissions', selectedRoleId],
        queryFn: async () => {
            const { data } = await api.get(`/admin/roles/${selectedRoleId}/permissions`);
            return data;
        },
        enabled: !!selectedRoleId
    });

    // Handle local changes to permissions
    const [editedPermissions, setEditedPermissions] = useState<any[]>([]);

    // When permissions change from API, reset edited state
    useState(() => {
        setEditedPermissions(permissions);
    });

    const handleCheckboxChange = (resource: string, field: string, checked: boolean) => {
        setEditedPermissions(prev => {
            const updated = [...prev];
            const idx = updated.findIndex(p => p.resource === resource);
            if (idx >= 0) {
                updated[idx] = { ...updated[idx], [field]: checked };
            } else {
                updated.push({
                    resource,
                    can_view: false,
                    can_create: false,
                    can_edit: false,
                    can_delete: false,
                    [field]: checked
                });
            }
            return updated;
        });
    };

    const updateMutation = useMutation({
        mutationFn: async () => {
            await api.put(`/admin/roles/${selectedRoleId}/permissions`, { permissions: editedPermissions });
        },
        onSuccess: () => {
            toast.success('Permissions updated successfully');
            queryClient.invalidateQueries({ queryKey: ['admin-permissions', selectedRoleId] });
        },
        onError: () => {
            toast.error('Failed to update permissions');
        }
    });

    const selectedRole = roles.find((r: any) => r.id === selectedRoleId);
    const displayPermissions = editedPermissions.length > 0 ? editedPermissions : permissions;

    const getPerm = (resource: string, field: string) => {
        const p = displayPermissions.find((p: any) => p.resource === resource);
        return p ? p[field] : false;
    };

    return (
        <div className="space-y-6 max-w-6xl">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Role & Permissions</h2>
                    <p className="text-muted-foreground mt-1">Manage role-based access overrides across the platform.</p>
                </div>
                <Button onClick={() => {
                    import('sonner').then(m => m.toast.info('Role creation is coming soon'));
                }}>
                    <Plus className="w-4 h-4 mr-2" /> Create Role
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 space-y-4">
                    <Card className="border-0 shadow-md h-full">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Shield className="w-4 h-4 text-primary" /> Roles
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 px-3">
                            <div className="px-1 mb-4">
                                <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="Search roles..." 
                                        className="pl-8" 
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                            
                            {isLoadingRoles ? (
                                <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                            ) : (
                                roles
                                    .filter((r: any) => r.name.toLowerCase().includes(search.toLowerCase()))
                                    .map((role: any) => (
                                    <div 
                                        key={role.id} 
                                        onClick={() => {
                                            setSelectedRoleId(role.id);
                                            setEditedPermissions([]);
                                        }}
                                        className={`p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors border ${selectedRoleId === role.id ? 'border-primary bg-accent/50' : 'border-transparent hover:border-border'}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <p className="font-semibold text-sm">{role.name}</p>
                                            {role.type === 'system' ? <Lock className="w-3 h-3 text-muted-foreground" /> : <Unlock className="w-3 h-3 text-muted-foreground" />}
                                        </div>
                                        <div className="flex items-center justify-between mt-1">
                                            <p className="text-xs text-muted-foreground truncate pr-2">{role.description}</p>
                                            <Badge variant="secondary" className="text-[10px]">{role.users} users</Badge>
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="md:col-span-2">
                    <Card className="border-0 shadow-md h-full">
                        {selectedRoleId ? (
                            <>
                                <CardHeader>
                                    <CardTitle className="text-base">{selectedRole?.name} Permissions</CardTitle>
                                    <CardDescription>Configure access overrides for this role.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {isLoadingPermissions ? (
                                        <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                                    ) : (
                                        <>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Resource</TableHead>
                                                        <TableHead className="text-center">View</TableHead>
                                                        <TableHead className="text-center">Create</TableHead>
                                                        <TableHead className="text-center">Edit</TableHead>
                                                        <TableHead className="text-center">Delete</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {['Users', 'Courses', 'Chapters', 'Problems', 'Finance', 'Settings'].map((resource) => (
                                                        <TableRow key={resource}>
                                                            <TableCell className="font-medium">{resource}</TableCell>
                                                            {['view', 'create', 'edit', 'delete'].map((action) => (
                                                                <TableCell key={action} className="text-center">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                                        checked={getPerm(resource, `can_${action}`)}
                                                                        onChange={(e) => handleCheckboxChange(resource, `can_${action}`, e.target.checked)}
                                                                        disabled={selectedRole?.type === 'system'}
                                                                    />
                                                                </TableCell>
                                                            ))}
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                            
                                            <div className="mt-6 flex justify-end">
                                                <Button 
                                                    onClick={() => updateMutation.mutate()} 
                                                    disabled={updateMutation.isPending || selectedRole?.type === 'system'}
                                                >
                                                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                                    Save Permissions
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center p-8 text-muted-foreground">
                                <Shield className="w-12 h-12 mb-4 opacity-20" />
                                <p>Select a role from the left to manage permissions</p>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}
