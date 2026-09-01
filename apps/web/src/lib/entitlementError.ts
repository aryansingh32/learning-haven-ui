export function parseEntitlementError(err: unknown): { denied: boolean; message?: string } {
  const anyErr = err as { status?: number; data?: { error?: { message?: string } | string } };
  if (anyErr?.status !== 403) return { denied: false };
  const data = anyErr.data?.error;
  const message = typeof data === 'string' ? data : data?.message;
  return { denied: true, message };
}
