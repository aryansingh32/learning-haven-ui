import { api } from './api.svc';

export const authService = {
    async signin(credentials: any) {
        const response: any = await api.post('/auth/signin', credentials);
        if (response.session?.access_token) {
            localStorage.setItem('auth_token', response.session.access_token);
        }
        return response;
    },

    async signup(data: any): Promise<any> {
        return api.post('/auth/signup', data);
    },

    async signout() {
        await api.post('/auth/signout');
        localStorage.removeItem('auth_token');
    },

    async getCurrentUser() {
        const response: any = await api.get('/users/me');
        return response;
    },

    async phoneSendOtp(phone: string) {
        return api.post('/auth/phone-send-otp', { phone });
    },

    async phoneVerifyOtp(phone: string, otp: string) {
        return api.post('/auth/phone-verify-otp', { phone, otp });
    },

    async phoneCompleteProfile(data: any) {
        return api.post('/auth/phone-complete-profile', data);
    }
};
