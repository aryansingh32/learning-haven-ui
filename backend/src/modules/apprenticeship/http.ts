export interface ApprenticeshipSuccess<T> {
  success: true;
  data: T;
}

export interface ApprenticeshipFailure {
  success: false;
  error: string;
  code: string;
  details?: unknown;
}

export const ok = <T>(data: T): ApprenticeshipSuccess<T> => ({
  success: true,
  data,
});

export const fail = (
  error: string,
  code: string,
  details?: unknown
): ApprenticeshipFailure => ({
  success: false,
  error,
  code,
  ...(details !== undefined ? { details } : {}),
});
