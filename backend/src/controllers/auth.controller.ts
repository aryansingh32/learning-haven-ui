import { Request, Response } from 'express';
import { supabase } from '../config/database';
import logger from '../config/logger';

export const signup = async (req: Request, res: Response) => {
    const { email, password, full_name } = req.body;

    if (!email || !password || !full_name) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name,
                },
            },
        });

        if (error) {
            logger.warn(`Signup failed for ${email}: ${error.message}`);
            return res.status(400).json({ error: error.message });
        }

        if (data.user) {
            // Create user profile in public.users table
            // Note: If using triggers, this might be redundant or cause conflict if not handled.
            // But based on the migration file, there is NO trigger on auth.users -> public.users.
            // So we MUST do it manually here.

            const { error: profileError } = await supabase
                .from('users')
                .insert([
                    {
                        id: data.user.id,
                        email: data.user.email,
                        full_name: full_name,
                        // other fields have defaults
                    },
                ]);

            if (profileError) {
                logger.error(`Failed to create user profile for ${data.user.id}: ${profileError.message}`);
                // Optional: rollback auth user creation? Hard with Supabase client.
                // For now, just return error.
                return res.status(500).json({ error: 'Failed to create user profile' });
            }
        }

        res.status(201).json({ message: 'User created successfully', user: data.user, session: data.session });
    } catch (err: any) {
        logger.error('Signup error', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const signin = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Missing email or password' });
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            logger.warn(`Signin failed for ${email}: ${error.message}`);
            return res.status(401).json({ error: error.message });
        }

        res.json({ session: data.session, user: data.user });
    } catch (err: any) {
        logger.error('Signin error', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const signout = async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(400).json({ error: 'No token provided' });

    const { error } = await supabase.auth.signOut({ scope: 'local' });

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    res.json({ message: 'Signed out successfully' });
};
