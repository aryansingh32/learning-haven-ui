import { pool } from './src/config/database';

const DEFAULT_CAREERS = [
  { id: 'ds', title: 'Data Scientist', salary: '₹8.2L avg', jobs: '34k open roles', skills: ['Python', 'ML', 'SQL'], image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&auto=format&fit=crop' },
  { id: 'be', title: 'Backend Developer', salary: '₹7.5L avg', jobs: '52k open roles', skills: ['Java', 'DSA', 'APIs'], image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&auto=format&fit=crop' },
  { id: 'java', title: 'Java Developer', salary: '₹6.8L avg', jobs: '41k open roles', skills: ['Java', 'Spring', 'SQL'], image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&auto=format&fit=crop' },
  { id: 'ai', title: 'AI Engineer', salary: '₹12L avg', jobs: '18k open roles', skills: ['Python', 'LLMs', 'ML'], image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&auto=format&fit=crop' },
  { id: 'sec', title: 'Cybersecurity Analyst', salary: '₹9.1L avg', jobs: '22k open roles', skills: ['Networks', 'Linux', 'Security'], image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=400&auto=format&fit=crop' },
  { id: 'flutter', title: 'Flutter Developer', salary: '₹6.2L avg', jobs: '15k open roles', skills: ['Dart', 'Mobile', 'UI'], image: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400&auto=format&fit=crop' },
];

const DEFAULT_PARTNERS = [
  { name: 'Google', logo: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg', courses: 48 },
  { name: 'Microsoft', logo: 'https://upload.wikimedia.org/wikipedia/commons/9/96/Microsoft_logo_%282012%29.svg', courses: 34 },
  { name: 'IBM', logo: 'https://upload.wikimedia.org/wikipedia/commons/5/51/IBM_logo.svg', courses: 29 },
  { name: 'Meta', logo: 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Meta_Platforms_Inc._logo.svg', courses: 22 },
  { name: 'Amazon', logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg', courses: 31 },
  { name: 'Netflix', logo: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg', courses: 12 },
  { name: 'Uber', logo: 'https://upload.wikimedia.org/wikipedia/commons/c/cc/Uber_logo_2018.png', courses: 14 },
  { name: 'Spotify', logo: 'https://upload.wikimedia.org/wikipedia/commons/2/26/Spotify_logo_with_text.svg', courses: 9 },
  { name: 'Adobe', logo: 'https://upload.wikimedia.org/wikipedia/commons/8/8d/Adobe_Corporate_Logo.svg', courses: 18 },
  { name: 'Oracle', logo: 'https://upload.wikimedia.org/wikipedia/commons/5/50/Oracle_logo.svg', courses: 26 },
  { name: 'Nvidia', logo: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Nvidia_logo.svg', courses: 11 },
];

const DEFAULT_HERO_SLIDES = [
  {
    id: 'backend',
    title: 'Become a Backend Developer',
    subtitle: 'Java • Spring Boot • DSA • Real Projects',
    tags: ['Java', 'Spring Boot', 'DSA', 'Projects'],
    stat: '42 courses in path',
    buttonText: 'Start Path',
    buttonLink: '/courses',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=700&auto=format&fit=crop',
    variant: 'primary',
  },
  {
    id: 'dsa',
    title: 'Master DSA Interviews',
    subtitle: '250 questions • 50 challenges • Google-inspired patterns',
    tags: ['Arrays', 'Trees', 'Graphs', 'DP'],
    stat: 'Interview-ready in 12 weeks',
    buttonText: 'Explore DSA',
    buttonLink: '/courses',
    image: 'https://images.unsplash.com/photo-1531482615710-2aabfdbf163e?w=700&auto=format&fit=crop',
    variant: 'dark',
  },
  {
    id: 'ai',
    title: 'AI-Guided Learning',
    subtitle: 'Personal mentor • Daily missions • Smart recommendations',
    tags: ['AI Mentor', 'Daily Quests', 'XP & Badges'],
    stat: 'Contextual coaching built-in',
    buttonText: 'Meet Your Mentor',
    buttonLink: '/ai-coach',
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=700&auto=format&fit=crop',
    variant: 'accent',
  },
];

async function seedCms() {
  const client = await pool.connect();
  try {
    const layout = {
      sliderActive: true,
      sliderBanners: DEFAULT_HERO_SLIDES,
      sections: {
        universities: {
          text: "Learn from courses inspired by industry leaders",
          partners: DEFAULT_PARTNERS,
        },
        careers: {
          items: DEFAULT_CAREERS,
        },
        categories: {
          active: true,
          title: "Explore categories",
          items: [
            { id: "development", title: "Development", icon: "Code", color: "bg-blue-500/10 text-blue-500", count: 120 },
            { id: "business", title: "Business", icon: "Briefcase", color: "bg-amber-500/10 text-amber-500", count: 85 },
            { id: "finance", title: "Finance & Accounting", icon: "LineChart", color: "bg-emerald-500/10 text-emerald-500", count: 64 },
            { id: "it", title: "IT & Software", icon: "Brain", color: "bg-purple-500/10 text-purple-500", count: 92 },
          ]
        }
      }
    };

    const valueStr = JSON.stringify(layout);

    // Upsert the catalog_layout
    await client.query(`
      INSERT INTO system_settings (key, value)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (key) 
      DO UPDATE SET value = $2::jsonb, updated_at = NOW()
    `, ['catalog_layout', valueStr]);

    console.log('Successfully seeded catalog CMS settings.');
  } catch (error) {
    console.error('Failed to seed CMS:', error);
  } finally {
    client.release();
    pool.end();
  }
}

seedCms();
