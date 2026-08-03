import { api, unwrap } from '../../../services/api.svc';
import { clearStoredSession, persistSession } from '@/lib/authSession';

export const authService = {
  async signin(credentials: { email: string; password: string }) {
    const response = await unwrap<{ session?: { access_token: string; refresh_token?: string } }>(
      api.post('/auth/signin', credentials)
    );
    if (response.session?.access_token) {
      persistSession(response.session as { access_token: string; refresh_token: string });
    }
    return response;
  },

  async signup(data: { email: string; password: string; full_name: string; referral_code?: string }) {
    const response = await unwrap<{ session?: { access_token: string; refresh_token?: string } }>(
      api.post('/auth/signup', data)
    );
    if (response.session?.access_token) {
      persistSession(response.session as { access_token: string; refresh_token: string });
    }
    return response;
  },

  async signout() {
    try {
      await api.post('/auth/signout');
    } finally {
      clearStoredSession();
    }
  },

  async getCurrentUser() {
    return api.get('/users/me');
  },

  async phoneSendOtp(phone: string) {
    return api.post('/auth/phone-send-otp', { phone });
  },

  async phoneVerifyOtp(phone: string, otp: string) {
    return api.post('/auth/phone-verify-otp', { phone, otp });
  },

  async phoneCompleteProfile(data: Record<string, unknown>) {
    return api.post('/auth/phone-complete-profile', data);
  },
};
