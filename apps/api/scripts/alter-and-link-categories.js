const { Client } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;

async function run() {
    const client = new Client({
        connectionString: connectionString,
    });

    try {
        await client.connect();
        console.log('Connected to database...');

        // 1. Add category_id to problems table if it does not exist
        console.log('Altering problems table to add category_id...');
        await client.query(`
            ALTER TABLE public.problems 
            ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id);
        `);
        console.log('Table alteration completed.');

        // 2. Insert missing categories from problems' topics
        console.log('Inserting categories from problem topics...');
        const catRes = await client.query(`
            INSERT INTO public.categories (name, slug, is_active, order_index, created_at, updated_at)
            SELECT DISTINCT 
                topic as name, 
                LOWER(REGEXP_REPLACE(topic, '[^a-zA-Z0-9]+', '-', 'g')) as slug,
                true as is_active,
                1 as order_index,
                NOW() as created_at,
                NOW() as updated_at
            FROM public.problems
            WHERE topic IS NOT NULL AND topic <> ''
            ON CONFLICT (slug) DO NOTHING;
        `);
        console.log(`Categories insert completed. Rows affected: ${catRes.rowCount}`);

        // 3. Link problems to categories
        console.log('Linking problems to categories...');
        const linkRes = await client.query(`
            UPDATE public.problems p
            SET category_id = c.id
            FROM public.categories c
            WHERE p.category_id IS NULL
              AND p.topic IS NOT NULL
              AND c.slug = LOWER(REGEXP_REPLACE(p.topic, '[^a-zA-Z0-9]+', '-', 'g'));
        `);
        console.log(`Problem linking completed. Rows updated: ${linkRes.rowCount}`);

        // 4. Verification queries
        console.log('\n--- VERIFICATION COUNTS ---');
        
        const coursesCount = await client.query('SELECT COUNT(*) FROM public.courses;');
        console.log(`courses count: ${coursesCount.rows[0].count}`);

        const chaptersCount = await client.query('SELECT COUNT(*) FROM public.chapters;');
        console.log(`chapters count: ${chaptersCount.rows[0].count}`);

        const categoriesCount = await client.query('SELECT COUNT(*) FROM public.categories;');
        console.log(`categories count: ${categoriesCount.rows[0].count}`);

        const problemsCount = await client.query('SELECT COUNT(*) FROM public.problems;');
        console.log(`problems count: ${problemsCount.rows[0].count}`);

        const linkedProblemsCount = await client.query('SELECT COUNT(*) FROM public.problems WHERE category_id IS NOT NULL;');
        console.log(`linked problems count (category_id is not null): ${linkedProblemsCount.rows[0].count}`);

        // Select sample problems and their categories
        const samples = await client.query(`
            SELECT p.title, p.difficulty, p.topic, c.name as category_name
            FROM public.problems p
            LEFT JOIN public.categories c ON p.category_id = c.id
            LIMIT 10;
        `);
        console.log('\n--- SAMPLE PROBLEMS ---');
        console.table(samples.rows);

    } catch (err) {
        console.error('Error during database update:', err);
    } finally {
        await client.end();
    }
}

run();
