import fs from 'fs';
import path from 'path';
import { supabase, pool } from '../../../config/database';
import { CacheService } from '../../core/services/cache.service';
import logger from '../../../config/logger';

export class AdminHealthService {
    static async getSystemHealth() {
        // Ping Database
        const dbStart = Date.now();
        let dbStatus = 'operational';
        let dbPing = 0;
        try {
            await pool.query('SELECT 1');
            dbPing = Date.now() - dbStart;
        } catch (e) {
            dbStatus = 'down';
        }

        // Ping Redis (Auth Node / Cache)
        const cacheStart = Date.now();
        let cacheStatus = 'operational';
        let cachePing = 0;
        try {
            await CacheService.get('health-ping');
            cachePing = Date.now() - cacheStart;
        } catch (e) {
            cacheStatus = 'down';
        }

        // Mock recent errors (read from error log file if possible)
        let recentErrors: any[] = [];
        try {
            const dateStr = new Date().toISOString().split('T')[0];
            const logPath = path.join(process.cwd(), 'logs', `error-${dateStr}.log`);
            if (fs.existsSync(logPath)) {
                const logs = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
                recentErrors = logs.slice(-10).map((log, idx) => {
                    const parsed = JSON.parse(log);
                    return {
                        id: parsed.requestId || idx,
                        service: parsed.service || 'Core API',
                        message: parsed.message,
                        time: parsed.timestamp,
                        level: parsed.level === 'error' ? 'critical' : 'warning',
                    };
                }).reverse();
            }
        } catch (e) {
            logger.warn('Failed to read error logs for health monitor');
        }

        // Generate synthetic or real response time data
        // For a real production app, we would query Prometheus, DataDog or Redis metrics
        const mockResponseTimes = Array.from({ length: 24 }).map((_, i) => {
            const hour = new Date();
            hour.setHours(hour.getHours() - (23 - i));
            return {
                time: `${hour.getHours()}:00`,
                api: Math.floor(Math.random() * 50) + 20,
                db: Math.floor(Math.random() * 20) + 5,
                auth: Math.floor(Math.random() * 30) + 10,
            };
        });

        const systemDegraded = dbStatus === 'down' || cacheStatus === 'down';

        return {
            status: systemDegraded ? 'degraded' : 'operational',
            services: [
                { name: 'Core API', status: 'operational', uptime: '99.99%', ping: '12ms' }, // Node is running if this returns
                { name: 'Database', status: dbStatus, uptime: '99.98%', ping: `${dbPing}ms` },
                { name: 'Redis / Auth', status: cacheStatus, uptime: '99.99%', ping: `${cachePing}ms` },
            ],
            errors: recentErrors,
            responseTimes: mockResponseTimes
        };
    }
}
