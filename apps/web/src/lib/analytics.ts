import { api } from '@/services/api.svc';

// Utility to manage cookies
const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return null;
};

const setCookie = (name: string, value: string, days = 30) => {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/`;
};

// Generate an anonymous tracking ID if not exists
const getTrackingId = () => {
    let id = getCookie('lh_tracker_id');
    if (!id) {
        id = 'anon_' + Math.random().toString(36).substring(2, 15);
        setCookie('lh_tracker_id', id);
    }
    return id;
};

// Track Page Views
export const trackPageView = (path: string) => {
    const trackingId = getTrackingId();
    // Silently log to backend without awaiting
    api.post('/analytics/track', {
        event_type: 'page_view',
        path,
        tracking_id: trackingId,
        timestamp: new Date().toISOString()
    }).catch(() => {
        // Suppress errors to not interfere with user experience
    });
};

// Track Clicks or Actions
export const trackAction = (actionName: string, metadata: any = {}) => {
    const trackingId = getTrackingId();
    api.post('/analytics/track', {
        event_type: 'action',
        action_name: actionName,
        metadata,
        tracking_id: trackingId,
        timestamp: new Date().toISOString()
    }).catch(() => {});
};

// Global Error Tracking
export const initErrorTracking = () => {
    window.addEventListener('error', (event) => {
        const trackingId = getTrackingId();
        api.post('/analytics/track', {
            event_type: 'error',
            error_message: event.message,
            error_stack: event.error?.stack,
            path: window.location.pathname,
            tracking_id: trackingId,
            timestamp: new Date().toISOString()
        }).catch(() => {});
    });

    window.addEventListener('unhandledrejection', (event) => {
        const trackingId = getTrackingId();
        api.post('/analytics/track', {
            event_type: 'unhandled_rejection',
            error_message: event.reason?.message || 'Promise rejection',
            path: window.location.pathname,
            tracking_id: trackingId,
            timestamp: new Date().toISOString()
        }).catch(() => {});
    });
};
