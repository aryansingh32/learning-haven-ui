import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { logger } from '../lib/logger';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

class ApiService {
    private axiosInstance: AxiosInstance;

    constructor() {
        this.axiosInstance = axios.create({
            baseURL: API_BASE_URL,
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 15000,
        });

        this.setupInterceptors();
    }

    private setupInterceptors() {
        // Request Interceptor: Add Auth Token
        this.axiosInstance.interceptors.request.use(
            (config: InternalAxiosRequestConfig) => {
                const token = localStorage.getItem('auth_token');
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

        // Response Interceptor: Handle Global Errors
        this.axiosInstance.interceptors.response.use(
            (response) => {
                logger.debug(`API Response: ${response.status} ${response.config.url}`, response.data);
                return response.data;
            },
            (error: AxiosError) => {
                const status = error.response?.status;
                const message = (error.response?.data as any)?.error || error.message;

                logger.error(`API Error [${status}]: ${message}`, {
                    url: error.config?.url,
                    method: error.config?.method,
                    data: error.config?.data,
                });

                if (status === 401) {
                    // Handle Unauthorized (e.g., redirect to login or refresh token)
                    logger.warn('Unauthorized access - potential token expiration');
                    localStorage.removeItem('auth_token');
                    // Optional: window.location.href = '/login';
                }

                return Promise.reject(new Error(message));
            }
        );
    }

    get instance() {
        return this.axiosInstance;
    }
}

export const api = new ApiService().instance;
export default api;
