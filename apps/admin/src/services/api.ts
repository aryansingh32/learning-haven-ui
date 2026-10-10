import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
    },
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => response,
    (error) => {
        // The API sends errors as { error: string } or { error: { code, message } }. Pages render
        // `response.data.error` as text, so make it a string (keeping the code) before they see it.
        const data = error.response?.data;
        if (data && data.error && typeof data.error === 'object') {
            data.errorCode = data.error.code;
            data.error = data.error.message || data.error.code || 'Something went wrong';
        }
        if (error.response?.status === 429 && data && typeof data === 'object' && !data.error) {
            data.error = 'Too many requests. Wait a minute and try again.';
        }
        // A 401 on a signed-in call means the session ended: back to the login page. A 401 from the
        // sign-in request itself is just a wrong password; the login form shows it.
        const isSignIn = String(error.config?.url ?? '').includes('/auth/signin');
        if (error.response?.status === 401 && !isSignIn) {
            localStorage.removeItem('token');
            if (window.location.pathname !== '/login') window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
