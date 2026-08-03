import { supabase } from './apps/api/src/config/database';
import { CacheService } from './apps/api/src/modules/core/services/cache.service';

const seedCategories = async () => {
    console.log('Seeding categories...');
    const categories = [
        { name: 'Computer Science', slug: 'computer-science', description: 'Foundations of computing, data structures, and algorithms', icon: 'Code', color: '#3b82f6', order_index: 1, is_active: true },
        { name: 'Data Science', slug: 'data-science', description: 'Machine learning, AI, data analysis and statistics', icon: 'LineChart', color: '#10b981', order_index: 2, is_active: true },
        { name: 'Artificial Intelligence', slug: 'artificial-intelligence', description: 'Deep learning, neural networks, and modern AI', icon: 'Brain', color: '#8b5cf6', order_index: 3, is_active: true },
        { name: 'Business', slug: 'business', description: 'Management, leadership, and product strategy', icon: 'Briefcase', color: '#f59e0b', order_index: 4, is_active: true },
        { name: 'Web Development', slug: 'web-development', description: 'Frontend, backend, and full-stack web technologies', icon: 'Layout', color: '#ec4899', order_index: 5, is_active: true },
        { name: 'Cybersecurity', slug: 'cybersecurity', description: 'Network security, cryptography, and ethical hacking', icon: 'Shield', color: '#ef4444', order_index: 6, is_active: true }
    ];

    for (const cat of categories) {
        const { error } = await supabase.from('categories').upsert(cat, { onConflict: 'slug' });
        if (error) {
            console.error('Error inserting category:', cat.name, error);
        } else {
            console.log('Inserted:', cat.name);
        }
    }

    await CacheService.delPattern('categories:*');
    console.log('Done!');
    process.exit(0);
};

seedCategories();
