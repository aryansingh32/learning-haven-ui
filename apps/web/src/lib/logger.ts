type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class Logger {
    private isDevelopment = import.meta.env.DEV;

    private formatMessage(level: LogLevel, message: string, ...args: any[]) {
        const timestamp = new Date().toISOString();
        return [`[${timestamp}] [${level.toUpperCase()}] ${message}`, ...args];
    }

    info(message: string, ...args: any[]) {
        if (this.isDevelopment) {
            console.log(...this.formatMessage('info', message, ...args));
        }
    }

    warn(message: string, ...args: any[]) {
        if (this.isDevelopment) {
            console.warn(...this.formatMessage('warn', message, ...args));
        }
    }

    error(message: string, ...args: any[]) {
        // In production, we might want to send this to a service like Sentry
        console.error(...this.formatMessage('error', message, ...args));
    }

    debug(message: string, ...args: any[]) {
        if (this.isDevelopment) {
            console.debug(...this.formatMessage('debug', message, ...args));
        }
    }
}

export const logger = new Logger();
