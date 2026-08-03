import { Request, Response } from 'express';
import { AdminPermissionsService } from '../services/admin-permissions.service';
import logger from '../../../config/logger';

export class AdminPermissionsController {
    static async getRoles(req: Request, res: Response) {
        try {
            const roles = await AdminPermissionsService.getRoles();
            res.json(roles);
        } catch (error) {
            logger.error('Get roles error:', error);
            res.status(500).json({ error: 'Failed to fetch roles' });
        }
    }

    static async getRolePermissions(req: Request, res: Response) {
        try {
            const permissions = await AdminPermissionsService.getPermissionsForRole(String(req.params.roleId));
            res.json(permissions);
        } catch (error) {
            logger.error('Get role permissions error:', error);
            res.status(500).json({ error: 'Failed to fetch permissions' });
        }
    }

    static async updateRolePermissions(req: Request, res: Response) {
        try {
            const { permissions } = req.body;
            await AdminPermissionsService.updateRolePermissions(String(req.params.roleId), permissions);
            res.json({ success: true });
        } catch (error) {
            logger.error('Update role permissions error:', error);
            res.status(500).json({ error: 'Failed to update permissions' });
        }
    }

    static async createRole(req: Request, res: Response) {
        try {
            const role = await AdminPermissionsService.createRole(req.body);
            res.status(201).json(role);
        } catch (error) {
            logger.error('Create role error:', error);
            res.status(500).json({ error: 'Failed to create role' });
        }
    }
}
