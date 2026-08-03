type TrackingEvent = {
  event_type: string;
  event_category?: string;
  event_data?: Record<string, unknown>;
  page_url: string;
  referrer_url?: string;
  session_id: string;
  enrollment_id?: string | null;
  project_id?: string | null;
  submission_id?: string | null;
  timestamp: string;
};

class ApprenticeshipTracker {
  private queue: TrackingEvent[] = [];
  private sessionId: string;
  private pageEnteredAt: number;
  private flushTimer: number | null = null;

  constructor() {
    this.sessionId = this.getOrCreateSessionId();
    this.pageEnteredAt = Date.now();
    this.setupPageUnloadFlush();
    this.setupPeriodicFlush();
  }

  track(eventType: string, data: Record<string, unknown> = {}, options?: Partial<TrackingEvent>) {
    this.queue.push({
      event_type: eventType,
      event_data: data,
      page_url: window.location.pathname,
      referrer_url: document.referrer || undefined,
      session_id: this.sessionId,
      timestamp: new Date().toISOString(),
      ...options,
    });
  }

  trackPageView(data: Record<string, unknown> = {}) {
    this.pageEnteredAt = Date.now();
    this.track('page_view', { path: window.location.pathname, referrer: document.referrer, ...data });
  }

  trackTimeOnPage(data: Record<string, unknown> = {}) {
    this.track('time_on_page', {
      duration_ms: Date.now() - this.pageEnteredAt,
      path: window.location.pathname,
      ...data,
    });
  }

  trackClick(element: string, data: Record<string, unknown> = {}) {
    this.track('click', { element, ...data });
  }

  async flush() {
    if (this.queue.length === 0) return;

    const events = [...this.queue.splice(0, 50)];
    const body = JSON.stringify({ events });

    if (navigator.sendBeacon) {
      const payload = new Blob([body], { type: 'application/json' });
      const accepted = navigator.sendBeacon('/api/v1/apprenticeship/track', payload);
      if (accepted) return;
      this.queue.unshift(...events);
    }

    await fetch('/api/v1/apprenticeship/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': this.sessionId,
      },
      body,
      keepalive: true,
    }).catch(() => {
      this.queue.unshift(...events);
    });
  }

  private setupPageUnloadFlush() {
    const flushOnExit = () => {
      this.trackTimeOnPage();
      void this.flush();
    };
    window.addEventListener('beforeunload', flushOnExit);
    window.addEventListener('pagehide', flushOnExit);
  }

  private setupPeriodicFlush() {
    this.flushTimer = window.setInterval(() => {
      void this.flush();
    }, 5000);
  }

  private getOrCreateSessionId() {
    const key = 'apprenticeship_session_id';
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const next = crypto.randomUUID();
    localStorage.setItem(key, next);
    return next;
  }
}

export const tracker = new ApprenticeshipTracker();
