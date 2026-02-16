import { supabase } from '../config/database';
import logger from '../config/logger';

export class NotesService {
    /**
     * Get notes for a problem
     */
    static async getNotes(user_id: string, problem_id: string) {
        try {
            const { data, error } = await supabase
                .from('user_notes')
                .select('*')
                .eq('user_id', user_id)
                .eq('problem_id', problem_id)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            return data || { content: '', pattern_notes: '', mistake_log: null };
        } catch (error) {
            logger.error('Error fetching notes:', { user_id, problem_id, error });
            throw new Error('Failed to fetch notes');
        }
    }

    /**
     * Save/Update notes
     */
    static async saveNotes(user_id: string, problem_id: string, data: any) {
        try {
            const { content, pattern_notes, mistake_log } = data;

            const { data: result, error } = await supabase
                .from('user_notes')
                .upsert({
                    user_id,
                    problem_id,
                    content,
                    pattern_notes,
                    mistake_log,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id, problem_id' })
                .select()
                .single();

            if (error) throw error;

            return result;
        } catch (error) {
            logger.error('Error saving notes:', { user_id, problem_id, error });
            throw new Error('Failed to save notes');
        }
    }
}
