/** Stable pseudo-rating from course id (4.5–4.9) */
export function courseRating(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i) * (i + 1)) % 97;
  return Math.round((4.5 + (hash % 5) * 0.1) * 10) / 10;
}

export function formatLearners(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(count);
}

export function learnerCount(course: { enrolled_count?: number; item_count?: number; id: string }): number {
  if (course.enrolled_count && course.enrolled_count > 0) return course.enrolled_count;
  const base = (course.item_count || 8) * 1400;
  let hash = 0;
  for (const c of course.id) hash += c.charCodeAt(0);
  return base + (hash % 8000);
}

export function courseDuration(course: { duration_days?: number; item_count?: number }): string {
  if (course.duration_days) {
    const weeks = Math.max(1, Math.round(course.duration_days / 7));
    return weeks === 1 ? '1 week' : `${weeks} weeks`;
  }
  const chapters = course.item_count || 8;
  const weeks = Math.max(2, Math.round(chapters * 0.75));
  return `${weeks} weeks`;
}

export function courseDifficulty(course: { difficulty_level?: string }): string {
  const d = course.difficulty_level || 'beginner';
  return d.charAt(0).toUpperCase() + d.slice(1);
}

const COVER_FALLBACKS = [
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1531482615710-2aabfdbf163e?w=600&auto=format&fit=crop',
];

export function courseCover(course: { cover_image?: string; meta?: { image_url?: string }; id: string; title?: string }): string {
  if (course.cover_image) return course.cover_image;
  if (course.meta?.image_url) return course.meta.image_url;
  let hash = 0;
  for (const c of course.id) hash += c.charCodeAt(0);
  return COVER_FALLBACKS[hash % COVER_FALLBACKS.length];
}

export const PARTNER_ROTATION = ['Google', 'IBM', 'Microsoft', 'Meta', 'Amazon'];

export function coursePartner(course: { id: string }, index?: number): string {
  if (typeof index === 'number') return PARTNER_ROTATION[index % PARTNER_ROTATION.length];
  let hash = 0;
  for (const c of course.id) hash += c.charCodeAt(0);
  return PARTNER_ROTATION[hash % PARTNER_ROTATION.length];
}

export const TRENDING_SEARCHES = ['Java', 'DSA', 'Spring Boot', 'Cybersecurity', 'AI', 'Two Pointers', 'System Design'];

export const DEFAULT_CAREERS = [
  { id: 'ds', title: 'Data Scientist', salary: '₹8.2L avg', jobs: '34k open roles', skills: ['Python', 'ML', 'SQL'], image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&auto=format&fit=crop' },
  { id: 'be', title: 'Backend Developer', salary: '₹7.5L avg', jobs: '52k open roles', skills: ['Java', 'DSA', 'APIs'], image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&auto=format&fit=crop' },
  { id: 'java', title: 'Java Developer', salary: '₹6.8L avg', jobs: '41k open roles', skills: ['Java', 'Spring', 'SQL'], image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&auto=format&fit=crop' },
  { id: 'ai', title: 'AI Engineer', salary: '₹12L avg', jobs: '18k open roles', skills: ['Python', 'LLMs', 'ML'], image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&auto=format&fit=crop' },
  { id: 'sec', title: 'Cybersecurity Analyst', salary: '₹9.1L avg', jobs: '22k open roles', skills: ['Networks', 'Linux', 'Security'], image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=400&auto=format&fit=crop' },
  { id: 'flutter', title: 'Flutter Developer', salary: '₹6.2L avg', jobs: '15k open roles', skills: ['Dart', 'Mobile', 'UI'], image: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400&auto=format&fit=crop' },
];

export const DEFAULT_PARTNERS = [
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

export type HeroSlide = {
  id: string;
  title: string;
  subtitle: string;
  tags?: string[];
  stat?: string;
  buttonText: string;
  buttonLink: string;
  image: string;
  variant: 'primary' | 'dark' | 'accent';
};

export const DEFAULT_HERO_SLIDES: HeroSlide[] = [
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
