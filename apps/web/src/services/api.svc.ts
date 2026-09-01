import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { logger } from '../lib/logger';
import {
  clearStoredSession,
  ensureValidAccessToken,
  getAccessToken,
  getRefreshToken,
  refreshAccessToken,
} from '@/lib/authSession';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

class ApiService {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      timeout: 20_000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.axiosInstance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const token = (await ensureValidAccessToken()) || getAccessToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`, config.data);
        return config;
      },
      (error: AxiosError) => {
        logger.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.debug(`API Response: ${response.status} ${response.config.url}`, response.data);
        return response.data;
      },
      async (error: AxiosError) => {
        const status = error.response?.status;
        const responseError = (error.response?.data as { error?: string | { message?: string } })?.error;
        const message =
          (typeof responseError === 'string' ? responseError : responseError?.message) || error.message;
        const config = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        const isAnalyticsTrack = config?.url?.includes('/analytics/track');
        const isExpectedRejection = status === 403 || status === 404;

        if (isExpectedRejection || isAnalyticsTrack) {
          logger.debug(`API Expected Rejection or Silent Error [${status}]: ${message}`, {
            url: config?.url,
          });
        } else {
          logger.error(`API Error [${status}]: ${message}`, {
            url: config?.url,
            method: config?.method,
            data: config?.data,
          });
        }

        if (status === 401 && config && !config._retry && getRefreshToken()) {
          const refreshed = await refreshAccessToken();

          if (refreshed) {
            config._retry = true;
            config.headers.Authorization = `Bearer ${refreshed}`;
            return this.axiosInstance.request(config);
          }
        }

        if (status === 401) {
          const msg = String(message || '').toLowerCase();
          const hadSession = Boolean(getAccessToken() || getRefreshToken());
          const refreshUnavailable = !getRefreshToken();
          const isTerminal =
            refreshUnavailable ||
            msg.includes('invalid token') ||
            msg.includes('invalid refresh') ||
            msg.includes('refresh token') ||
            msg.includes('no token');

          if (hadSession && isTerminal) {
            logger.warn('Session ended — clearing stored tokens');
            clearStoredSession();
          }
        }

        const apiError = new Error(message) as Error & { status?: number; data?: unknown };
        apiError.status = status;
        apiError.data = error.response?.data;
        return Promise.reject(apiError);
      }
    );
  }

  get instance() {
    return this.axiosInstance;
  }
}

export const api = new ApiService().instance;
export default api;

export interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function unwrap<T>(promise: Promise<any>): Promise<T> {
  const response = await promise;
  if (!response?.success || response.data === undefined) {
    throw new Error(response?.error || 'API request failed');
  }
  return response.data;
}
