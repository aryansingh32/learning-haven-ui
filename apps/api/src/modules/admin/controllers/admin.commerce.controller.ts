import { Request, Response } from 'express';
import { AdminCommerceService } from '../services/admin-commerce.service';
import logger from '../../../config/logger';

export const listPlans = async (req: Request, res: Response) => {
    try {
        const plans = await AdminCommerceService.listPlans();
        res.json(plans);
    } catch (error) {
        logger.error('List plans error:', error);
        res.status(500).json({ error: 'Failed to list plans' });
    }
};

export const createPlan = async (req: Request, res: Response) => {
    try {
        const plan = await AdminCommerceService.createPlan(req.body);
        res.status(201).json(plan);
    } catch (error) {
        logger.error('Create plan error:', error);
        res.status(500).json({ error: 'Failed to create plan' });
    }
};

export const updatePlan = async (req: Request, res: Response) => {
    try {
        const plan = await AdminCommerceService.updatePlan(String(req.params.id), req.body);
        res.json(plan);
    } catch (error) {
        logger.error('Update plan error:', error);
        res.status(500).json({ error: 'Failed to update plan' });
    }
};

export const deletePlan = async (req: Request, res: Response) => {
    try {
        await AdminCommerceService.deletePlan(String(req.params.id));
        res.json({ success: true });
    } catch (error) {
        logger.error('Delete plan error:', error);
        res.status(500).json({ error: 'Failed to delete plan' });
    }
};

export const listCoupons = async (req: Request, res: Response) => {
    try {
        const coupons = await AdminCommerceService.listCoupons();
        res.json(coupons);
    } catch (error) {
        logger.error('List coupons error:', error);
        res.status(500).json({ error: 'Failed to list coupons' });
    }
};

export const createCoupon = async (req: Request, res: Response) => {
    try {
        const coupon = await AdminCommerceService.createCoupon(req.body);
        res.status(201).json(coupon);
    } catch (error) {
        logger.error('Create coupon error:', error);
        res.status(500).json({ error: 'Failed to create coupon' });
    }
};

export const updateCoupon = async (req: Request, res: Response) => {
    try {
        const coupon = await AdminCommerceService.updateCoupon(String(req.params.id), req.body);
        res.json(coupon);
    } catch (error) {
        logger.error('Update coupon error:', error);
        res.status(500).json({ error: 'Failed to update coupon' });
    }
};

export const deleteCoupon = async (req: Request, res: Response) => {
    try {
        await AdminCommerceService.deleteCoupon(String(req.params.id));
        res.json({ success: true });
    } catch (error) {
        logger.error('Delete coupon error:', error);
        res.status(500).json({ error: 'Failed to delete coupon' });
    }
};

export const getRevenueStats = async (req: Request, res: Response) => {
    try {
        const stats = await AdminCommerceService.getRevenueStats();
        res.json(stats);
    } catch (error) {
        logger.error('Get revenue stats error:', error);
        res.status(500).json({ error: 'Failed to get revenue stats' });
    }
};
