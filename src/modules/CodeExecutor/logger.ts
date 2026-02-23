
/**
 * SaaS-grade Logger for the Code Execution Module.
 * Provides structured logging with analytics tracking.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface ExecutionAnalytics {
    language?: string;
    duration?: number;
    status?: string;
    codeLength?: number;
    testCaseCount?: number;
}

class CodeExecutorLogger {
    private isEnabled: boolean;
    private logLevel: LogLevel;
    private executionHistory: ExecutionAnalytics[] = [];

    constructor() {
        // In production, only show warnings and errors
        this.isEnabled = true;
        this.logLevel = (typeof import.meta !== 'undefined' &&
            (import.meta as any).env?.MODE === 'production') ? 'warn' : 'debug';
    }

    private shouldLog(level: LogLevel): boolean {
        if (!this.isEnabled) return false;
        const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
        return levels.indexOf(level) >= levels.indexOf(this.logLevel);
    }

    log(level: LogLevel, message: string, data?: any) {
        if (!this.shouldLog(level)) return;

        const timestamp = new Date().toISOString();
        const prefix = `[CodeExecutor ${timestamp}] [${level.toUpperCase()}]`;

        switch (level) {
            case 'info':
                console.log(`%c${prefix}`, 'color: #3b82f6; font-weight: bold;', message, data || '');
                break;
            case 'warn':
                console.warn(`%c${prefix}`, 'color: #f59e0b; font-weight: bold;', message, data || '');
                break;
            case 'error':
                console.error(`%c${prefix}`, 'color: #ef4444; font-weight: bold;', message, data || '');
                break;
            case 'debug':
                console.debug(`%c${prefix}`, 'color: #a8a29e; font-weight: bold;', message, data || '');
                break;
        }
    }

    info(message: string, data?: any) { this.log('info', message, data); }
    warn(message: string, data?: any) { this.log('warn', message, data); }
    error(message: string, data?: any) { this.log('error', message, data); }
    debug(message: string, data?: any) { this.log('debug', message, data); }

    /**
     * Track execution analytics for monitoring.
     */
    trackExecution(analytics: ExecutionAnalytics) {
        this.executionHistory.push({
            ...analytics,
        });

        // Keep last 100 entries
        if (this.executionHistory.length > 100) {
            this.executionHistory = this.executionHistory.slice(-100);
        }

        this.info('Execution tracked', analytics);
    }

    /**
     * Get execution analytics summary.
     */
    getAnalytics() {
        const total = this.executionHistory.length;
        if (total === 0) return { total: 0 };

        const byLanguage: Record<string, number> = {};
        const byStatus: Record<string, number> = {};
        let totalDuration = 0;

        for (const entry of this.executionHistory) {
            if (entry.language) byLanguage[entry.language] = (byLanguage[entry.language] || 0) + 1;
            if (entry.status) byStatus[entry.status] = (byStatus[entry.status] || 0) + 1;
            if (entry.duration) totalDuration += entry.duration;
        }

        return {
            total,
            byLanguage,
            byStatus,
            avgDuration: Math.round(totalDuration / total),
        };
    }

    /** Enable/disable logging */
    setEnabled(enabled: boolean) { this.isEnabled = enabled; }

    /** Set minimum log level */
    setLevel(level: LogLevel) { this.logLevel = level; }
}

export const logger = new CodeExecutorLogger();
