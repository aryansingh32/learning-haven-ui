/**
 * Signals from API responses that change what the whole app shows: maintenance
 * mode switched on (503 MAINTENANCE) and a suspended account (403 ACCOUNT_SUSPENDED).
 * The API client raises them; SystemStatusProvider listens.
 */
export type SystemEvent = { type: 'maintenance'; message: string } | { type: 'suspended'; message: string };

const target = new EventTarget();

export function emitSystemEvent(event: SystemEvent) {
  target.dispatchEvent(new CustomEvent('system', { detail: event }));
}

export function onSystemEvent(listener: (event: SystemEvent) => void): () => void {
  const handler = (e: Event) => listener((e as CustomEvent<SystemEvent>).detail);
  target.addEventListener('system', handler);
  return () => target.removeEventListener('system', handler);
}

/** Reads the API's error code and raises the matching event. */
export function systemEventFromResponse(status: number | undefined, data: unknown) {
  const error = (data as { error?: { code?: string; message?: string } } | undefined)?.error;
  if (!error || typeof error !== 'object') return;
  if (status === 503 && error.code === 'MAINTENANCE') emitSystemEvent({ type: 'maintenance', message: error.message ?? '' });
  if (status === 403 && error.code === 'ACCOUNT_SUSPENDED') emitSystemEvent({ type: 'suspended', message: error.message ?? '' });
}
