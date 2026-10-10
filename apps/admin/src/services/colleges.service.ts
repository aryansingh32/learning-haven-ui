import axios from 'axios';

/**
 * Forge staff's controls over colleges (the SaaS side of Forge Campus).
 * Talks to the Campus API's /platform endpoints with the admin's own sign-in;
 * the Campus API and the database both check that the caller is Forge staff.
 */
const CAMPUS_API = (import.meta.env.VITE_CAMPUS_API_URL || 'http://localhost:5100/campus/v1').replace(/\/+$/, '');

const campus = axios.create({ baseURL: CAMPUS_API, headers: { 'Content-Type': 'application/json' } });
campus.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});
campus.interceptors.response.use((r) => r, (error) => {
    const msg = error.response?.data?.error;
    return Promise.reject(new Error(typeof msg === 'string' ? msg : error.message));
});

export type CollegeStatus = 'active' | 'suspended' | 'archived';

export interface CollegeSummary {
    id: string;
    slug: string;
    name: string;
    status: CollegeStatus;
    seatLimit: number | null;
    createdAt: string;
    students: number;
    staff: number;
    pendingRoster: number;
    ownerEmail: string | null;
    assignments: number;
    attempts30d: number;
    lastActivityAt: string | null;
}

export interface CollegeDetail extends CollegeSummary {
    staffMembers: { userId: string; name: string | null; email: string; role: string; status: string }[];
    batches: { id: string; name: string; students: number }[];
}

export interface Licence {
    id: string;
    courseId: string | null;
    courseTitle: string | null;
    startsAt: string;
    endsAt: string | null;
    note: string | null;
    active: boolean;
}

export const collegesService = {
    list: async () => (await campus.get<CollegeSummary[]>('/platform/colleges')).data,
    get: async (id: string) => (await campus.get<CollegeDetail>(`/platform/colleges/${id}`)).data,
    create: async (data: { name: string; slug: string; ownerEmail: string; seatLimit: number | null }) =>
        (await campus.post('/platform/colleges', data)).data,
    update: async (id: string, data: { name?: string; seatLimit?: number | null; status?: CollegeStatus }) =>
        (await campus.patch<CollegeSummary>(`/platform/colleges/${id}`, data)).data,
    licences: async (id: string) => (await campus.get<Licence[]>(`/platform/colleges/${id}/licences`)).data,
    grantLicence: async (id: string, data: { courseId: string | null; endsAt: string | null; note: string | null }) =>
        (await campus.post(`/platform/colleges/${id}/licences`, data)).data,
    revokeLicence: async (id: string, licenceId: string) => { await campus.delete(`/platform/colleges/${id}/licences/${licenceId}`); },
    premiumCourses: async () => (await campus.get<{ id: string; title: string; isPremium: boolean }[]>('/platform/courses')).data,
};
