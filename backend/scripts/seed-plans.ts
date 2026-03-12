import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { PLANS_FALLBACK } from '../src/utils/plans';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedPlans() {
    console.log('Seeding plans_config table...');

    try {
        // Soft delete old plans that are not in the new fallback
        const newPlanIds = Object.keys(PLANS_FALLBACK);
        await supabase
            .from('plans_config')
            .update({ is_active: false })
            .not('id', 'in', `(${newPlanIds.map(id => `"${id}"`).join(',')})`); // Note: supabase-js handles this differently, let's just update all where id not in list

        let orderIndex = 1;
        for (const [id, planData] of Object.entries(PLANS_FALLBACK)) {
            const { error } = await supabase
                .from('plans_config')
                .upsert({
                    id: id,
                    name: planData.name,
                    price: planData.price,
                    currency: planData.currency,
                    interval: planData.interval,
                    features: JSON.stringify(planData.features),
                    metadata: { not_included: planData.not_included || [] },
                    problem_access: planData.problem_access,
                    ai_queries_limit: planData.ai_queries_limit,
                    is_active: true,
                    order_index: orderIndex++
                }, { onConflict: 'id' });

            if (error) {
                console.error(`Error upserting plan ${id}:`, error);
            } else {
                console.log(`Successfully upserted plan ${id}`);
            }
        }
        console.log('Finished seeding plans_config.');
        process.exit(0);
    } catch (err) {
        console.error('Script error:', err);
        process.exit(1);
    }
}

seedPlans();
