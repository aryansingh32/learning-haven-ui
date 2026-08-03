import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import ws from 'ws';

const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!, {
  auth: {
    persistSession: false
  },
  global: {
    fetch: fetch
  },
  realtime: {
    transport: ws
  }
});

async function seedSettings() {
    const defaultSettings = [
        {
            key: 'catalog_layout',
            category: 'general',
            description: 'Dynamic layout configuration for the Courses Catalog page',
            value: {
              "sliderActive": true,
              "sliderBanners": [
                {
                  "id": "slide1",
                  "title": "Become a Backend Developer",
                  "subtitle": "Java • Spring Boot • DSA • Real Projects",
                  "tags": ["Java", "Spring Boot", "DSA", "Projects"],
                  "stat": "42 courses in path",
                  "buttonText": "Start Path",
                  "buttonLink": "/courses",
                  "image": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=700&auto=format&fit=crop",
                  "bgColor": "from-blue-600 to-blue-800"
                },
                {
                  "id": "slide2",
                  "title": "Master DSA Interviews",
                  "subtitle": "250 questions • 50 challenges • Google-inspired patterns",
                  "tags": ["Arrays", "Trees", "Graphs", "DP"],
                  "stat": "Interview-ready in 12 weeks",
                  "buttonText": "Explore DSA",
                  "buttonLink": "/courses",
                  "image": "https://images.unsplash.com/photo-1531482615710-2aabfdbf163e?q=80&w=700&auto=format&fit=crop",
                  "bgColor": "from-[#020817] to-[#0B1730]"
                },
                {
                  "id": "slide3",
                  "title": "AI-Guided Learning",
                  "subtitle": "Personal mentor • Daily missions • Smart recommendations",
                  "tags": ["AI Mentor", "Daily Quests", "XP & Badges"],
                  "stat": "Contextual coaching built-in",
                  "buttonText": "Meet Your Mentor",
                  "buttonLink": "/ai-coach",
                  "image": "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=700&auto=format&fit=crop",
                  "bgColor": "from-[#071126] to-[#1e3a5f]"
                }
              ],
              "heroBanner": {
                "title": "Interactive Courses.",
                "highlight": "Master the fundamentals.",
                "subtitle": "Structured learning paths designed to take you from beginner to expert. Complete chapters, solve interactive problems, and track your progress.",
                "features": ["Interactive Learning", "Earn XP & Badges", "Structured Curriculum"]
              },
              "sections": {
                "universities": {
                  "active": true,
                  "title": "Learn from 350+ leading universities and companies",
                  "logos": [
                    "https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg",
                    "https://upload.wikimedia.org/wikipedia/commons/5/51/IBM_logo.svg",
                    "https://upload.wikimedia.org/wikipedia/commons/9/96/Microsoft_logo_%282012%29.svg"
                  ],
                  "actionCards": [
                    { "id": "ac1", "title": "Start a Career", "icon": "Badge" },
                    { "id": "ac2", "title": "Enterprise Learning", "icon": "Flag" },
                    { "id": "ac3", "title": "Degree Programs", "icon": "GraduationCap" }
                  ]
                },
                "categories": {
                  "active": true,
                  "title": "Explore categories",
                  "items": [
                    { "name": "Business", "icon": "Briefcase" },
                    { "name": "Artificial Intelligence", "icon": "Brain" },
                    { "name": "Data Science", "icon": "LineChart" },
                    { "name": "Computer Science", "icon": "Code" }
                  ]
                },
                "jobReady": {
                  "active": true,
                  "title": "Get job-ready for an in-demand career",
                  "subtitle": "No prior experience needed to get started.",
                  "tabs": [
                    { "id": "tab1", "label": "Data", "courses": [] },
                    { "id": "tab2", "label": "Business", "courses": [] },
                    { "id": "tab3", "label": "IT", "courses": [] }
                  ]
                },
                "newAndPopular": {
                  "active": true,
                  "title": "New and popular",
                  "columns": [
                    { "id": "col1", "title": "Most popular", "isAuto": true, "courses": [] },
                    { "id": "col2", "title": "Hot new releases", "isAuto": false, "courses": [] },
                    { "id": "col3", "title": "Trending AI courses", "isAuto": false, "courses": [] }
                  ]
                },
                "careers": {
                  "active": true,
                  "title": "Explore careers",
                  "items": [
                    { "id": "car1", "title": "Data Scientist", "description": "Analyze data at scale", "salary": "₹8.2L avg salary", "jobs": "34k open roles", "skills": ["Python", "ML", "SQL"], "image": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=400&auto=format&fit=crop" },
                    { "id": "car2", "title": "Backend Developer", "description": "Build scalable APIs", "salary": "₹7.5L avg salary", "jobs": "52k open roles", "skills": ["Java", "DSA", "APIs"], "image": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=400&auto=format&fit=crop" },
                    { "id": "car3", "title": "Java Developer", "description": "Enterprise applications", "salary": "₹6.8L avg salary", "jobs": "41k open roles", "skills": ["Java", "Spring", "SQL"], "image": "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=400&auto=format&fit=crop" },
                    { "id": "car4", "title": "AI Engineer", "description": "Build intelligent systems", "salary": "₹12L avg salary", "jobs": "18k open roles", "skills": ["Python", "LLMs", "ML"], "image": "https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=400&auto=format&fit=crop" },
                    { "id": "car5", "title": "Cybersecurity Analyst", "description": "Protect systems", "salary": "₹9.1L avg salary", "jobs": "22k open roles", "skills": ["Networks", "Linux", "Security"], "image": "https://images.unsplash.com/photo-1563986768609-322da13575f3?q=80&w=400&auto=format&fit=crop" },
                    { "id": "car6", "title": "Flutter Developer", "description": "Cross-platform mobile", "salary": "₹6.2L avg salary", "jobs": "15k open roles", "skills": ["Dart", "Mobile", "UI"], "image": "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=400&auto=format&fit=crop" }
                  ]
                }
              }
            }
        }
    ];

    for (const setting of defaultSettings) {
        const { error } = await supabase
            .from('system_settings')
            .upsert(setting, { onConflict: 'key' });

        if (error) {
            console.error(`Failed to seed ${setting.key}:`, error.message);
        } else {
            console.log(`Seeded ${setting.key}`);
        }
    }

    console.log('Dynamic catalog layout seeded successfully!');
}

seedSettings().catch(console.error);
