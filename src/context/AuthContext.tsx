import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/auth.service';

export interface User {
    id: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
    role?: string;
    level?: number;
    xp?: number;
}

export interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (credentials: any) => Promise<void>;
    register: (data: any) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('auth_token');
            if (token) {
                try {
                    const userProfile = await authService.getCurrentUser();
                    if (userProfile) {
                        setUser(userProfile);
                    } else {
                        // Token exists but no profile returned? Treat as invalid.
                        throw new Error("No user profile returned");
                    }
                } catch (error) {
                    console.error('Auth initialization failed', error);
                    localStorage.removeItem('auth_token');
                    setUser(null);
                }
            }
            setIsLoading(false);
        };

        initAuth();
    }, []);

    const login = async (credentials: any) => {
        try {
            await authService.signin(credentials);
            // Fetch profile to get full user details
            const userProfile = await authService.getCurrentUser();
            if (userProfile) {
                setUser(userProfile);
            }
        } catch (error) {
            console.error("Login failed:", error);
            throw error;
        }
    };

    const register = async (data: any) => {
        try {
            const response = await authService.signup(data);
            if (response.session?.access_token) {
                localStorage.setItem('auth_token', response.session.access_token);
                const userProfile = await authService.getCurrentUser();
                if (userProfile) {
                    setUser(userProfile);
                }
            }
        } catch (error) {
            console.error("Registration failed:", error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            await authService.signout();
        } catch (error) {
            console.error("Signout error:", error);
        } finally {
            setUser(null);
            localStorage.removeItem('auth_token');
            // Force redirect to signin
            window.location.href = '/signin';
        }
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
