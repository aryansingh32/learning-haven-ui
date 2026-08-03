import { pool } from './src/config/database';
import { v4 as uuidv4 } from 'uuid';

const mockMissions = [
  { id: 'p1_ch1', order: 1, title: 'Variables & Memory', concept: 'Memory addresses and value storage', locked: false, completedSteps: 8, totalSteps: 8, timeMinutes: 15, difficulty: 'easy', icon: 'Brain', reward: { xp: 100, badge: 'Scholar' }, storyIntro: 'Your phone has 128GB of secrets...' },
  { id: 'p1_ch2', order: 2, title: 'Conditionals', concept: 'Decision making logic in code', locked: false, completedSteps: 5, totalSteps: 5, timeMinutes: 20, difficulty: 'easy', icon: 'GitMerge', reward: { xp: 150, badge: 'Logic Master' }, storyIntro: 'Life is just a series of if-else statements...' },
  { id: 'p1_ch3', order: 3, title: 'Loops', concept: 'Automating repetitive tasks', locked: false, completedSteps: 6, totalSteps: 6, timeMinutes: 25, difficulty: 'easy', icon: 'RefreshCw', reward: { xp: 200, badge: 'Automation King' }, storyIntro: 'Imagine sending Happy Birthday to 500 contacts...' },
  { id: 'p1_ch4', order: 4, title: 'Functions', concept: 'Reusable code blocks and scope', locked: false, completedSteps: 3, totalSteps: 8, timeMinutes: 30, difficulty: 'medium', icon: 'LayoutGrid', reward: { xp: 250, badge: 'Architect' }, storyIntro: 'Don\'t repeat yourself. Build a machine...' },
  { id: 'p1_ch5', order: 5, title: 'Arrays', concept: 'Contiguous memory and indexing', locked: true, completedSteps: 0, totalSteps: 8, timeMinutes: 35, difficulty: 'medium', icon: 'Grid', reward: { xp: 300, badge: 'Organizer' }, storyIntro: 'Arrays are just organized dorms for your data...' },
];

const phases = [
  { id: 'phase-0', title: 'Phase 0: Mindset Revolution', subtitle: 'The Zero-to-Dangerous Era', difficulty_level: 'beginner', duration_days: 7, is_premium: false, is_published: true, missions: mockMissions.slice(0, 3) },
  { id: 'phase-1', title: 'Phase 1: Programming Foundations', subtitle: 'The Warrior\'s Arsenal', difficulty_level: 'beginner', duration_days: 14, is_premium: false, is_published: true, missions: mockMissions },
  { id: 'phase-2', title: 'Phase 2: DSA Foundations', subtitle: 'Building Your Weaponry', difficulty_level: 'intermediate', duration_days: 30, is_premium: true, is_published: true, missions: [] },
  { id: 'phase-3', title: 'Phase 3: DSA Patterns Mastery', subtitle: 'The Matrix Vision', difficulty_level: 'advanced', duration_days: 45, is_premium: true, is_published: true, missions: [] },
];

async function seed() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        console.log('Clearing existing courses and items...');
        await client.query('DELETE FROM public.course_items');
        await client.query('DELETE FROM public.courses');

        console.log('Seeding mock courses...');

        for (const phase of phases) {
            const courseId = uuidv4();
            const slug = phase.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            
            // Insert course
            await client.query(`
                INSERT INTO public.courses (id, title, description, slug, difficulty_level, duration_days, is_premium, is_published)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [courseId, phase.title, phase.subtitle, slug, phase.difficulty_level, phase.duration_days, phase.is_premium, phase.is_published]);

            // Insert missions as course_items
            for (const mission of phase.missions) {
                const itemId = uuidv4();
                await client.query(`
                    INSERT INTO public.course_items (id, course_id, title, description, order_index, day_number)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [itemId, courseId, mission.title, mission.concept, mission.order, mission.order]);
            }
        }

        await client.query('COMMIT');
        console.log('Seeding completed successfully.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Seeding failed:', error);
    } finally {
        client.release();
        pool.end();
    }
}

seed();
