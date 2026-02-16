import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, LoginCredentials } from '../types/auth';
import { authService } from '../services/auth.service';

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (credentials: LoginCredentials) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const userProfile = await authService.getProfile();
                    if (userProfile.role !== 'admin' && userProfile.role !== 'super_admin') {
                        throw new Error('Unauthorized');
                    }
                    setUser(userProfile);
                } catch (error) {
                    console.error('Auth initialization failed', error);
                    localStorage.removeItem('token');
                }
            }
            setIsLoading(false);
        };

        initAuth();
    }, []);

    const login = async (credentials: LoginCredentials) => {
        try {
            const { session } = await authService.login(credentials);
            localStorage.setItem('token', session.access_token);

            // Fetch profile to verify role
            const userProfile = await authService.getProfile();

            if (userProfile.role !== 'admin' && userProfile.role !== 'super_admin') {
                localStorage.removeItem('token');
                throw new Error('Access denied: Admins only');
            }

            setUser(userProfile);
        } catch (error) {
            throw error;
        }
    };

    const logout = () => {
        authService.logout();
        setUser(null);
        localStorage.removeItem('token');
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
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
