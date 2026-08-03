import { EventEmitter } from 'events';
import logger from '../../../config/logger';
import { requestContext } from '../../../middleware/requestTracer';

export interface DomainEvent<T = any> {
  /** Name of the event, e.g. 'github.push_received' */
  eventName: string;
  payload: T;
  /** Trace context attached automatically at publish time */
  meta: {
    requestId?: string;
    userId?: string;
    publishedAt: string;
  };
}

/**
 * EventBusService
 * Currently backed by Node.js EventEmitter (in-memory).
 * Designed to be easily swappable with Redis/RabbitMQ in the future.
 */
class EventBusService extends EventEmitter {
  constructor() {
    super();
  }

  publish<T = any>(eventName: string, payload: T): void {
    const ctx = requestContext.getStore();
    const event: DomainEvent<T> = {
      eventName,
      payload,
      meta: {
        requestId: ctx?.requestId,
        userId: ctx?.userId,
        publishedAt: new Date().toISOString(),
      },
    };
    logger.debug('EventBus publish', { eventName, requestId: event.meta.requestId });
    this.emit(eventName, event);
  }

  subscribe<T = any>(eventName: string, handler: (event: DomainEvent<T>) => void | Promise<void>): void {
    logger.debug('EventBus subscribe', { eventName });
    this.on(eventName, async (event: DomainEvent<T>) => {
      // Restore trace context for async handlers so all logs carry the originating requestId
      const store = { requestId: event.meta.requestId || 'async', userId: event.meta.userId };
      requestContext.run(store, async () => {
        try {
          await handler(event);
        } catch (error) {
          logger.error(`EventBus handler error [${eventName}]`, { error, requestId: event.meta.requestId });
        }
      });
    });
  }
}

export const EventBus = new EventBusService();
