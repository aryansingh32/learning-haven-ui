export interface User {
    id: string;
    email: string;
    full_name: string;
    role: 'user' | 'admin' | 'super_admin';
    avatar_url?: string;
    created_at: string;
    // Add other fields as needed
}

export interface AuthResponse {
    user: {
        id: string;
        email: string;
        // Supabase user object structure
        app_metadata: {
            provider: string;
            [key: string]: any;
        };
        user_metadata: {
            full_name?: string;
            [key: string]: any;
        };
        [key: string]: any;
    };
    session: {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        token_type: string;
        user: any;
    };
}

export interface LoginCredentials {
    email: string;
    password: string;
}
