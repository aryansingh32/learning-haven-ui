import { supabase } from '../../../config/database';

export class AdminPermissionsService {
    static async getRoles() {
        // Get roles and count of users assigned to each
        const { data: roles, error: rolesError } = await supabase
            .from('admin_roles')
            .select('*')
            .order('name');
            
        if (rolesError) throw rolesError;

        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('admin_role_id');

        if (usersError) throw usersError;

        const roleCounts = users.reduce((acc: any, user: any) => {
            if (user.admin_role_id) {
                acc[user.admin_role_id] = (acc[user.admin_role_id] || 0) + 1;
            }
            return acc;
        }, {});

        return roles.map((r: any) => ({
            ...r,
            users: roleCounts[r.id] || 0
        }));
    }

    static async getPermissionsForRole(roleId: string) {
        const { data, error } = await supabase
            .from('admin_permissions')
            .select('*')
            .eq('role_id', roleId);

        if (error) throw error;

        // Default empty permissions if none exist yet for the role
        const resources = ['Users', 'Courses', 'Chapters', 'Problems', 'Finance', 'Settings'];
        
        const permissions = resources.map(resource => {
            const existing = data.find(p => p.resource === resource);
            if (existing) return existing;
            return {
                role_id: roleId,
                resource,
                can_view: false,
                can_create: false,
                can_edit: false,
                can_delete: false
            };
        });

        return permissions;
    }

    static async updateRolePermissions(roleId: string, permissions: any[]) {
        // Update or insert each permission
        for (const p of permissions) {
            const { error } = await supabase
                .from('admin_permissions')
                .upsert({
                    role_id: roleId,
                    resource: p.resource,
                    can_view: p.can_view,
                    can_create: p.can_create,
                    can_edit: p.can_edit,
                    can_delete: p.can_delete,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'role_id,resource' });

            if (error) throw error;
        }

        return { success: true };
    }

    static async createRole(data: any) {
        const { data: role, error } = await supabase
            .from('admin_roles')
            .insert([{ name: data.name, description: data.description, type: 'custom' }])
            .select()
            .single();

        if (error) throw error;
        return role;
    }
}
