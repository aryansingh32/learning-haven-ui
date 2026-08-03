/**
 * Catalog helpers — all values are derived from the real course record
 * returned by GET /api/courses. No mock/stock data.
 */

export type CatalogCourse = {
  id: string;
  slug?: string;
  title: string;
  description?: string;
  cover_image?: string;
  difficulty_level?: string;
  duration_days?: number;
  is_premium?: boolean;
  is_published?: boolean;
  item_count?: number;
  chapter_count?: number;
  enrolled_count?: number;
  type?: string;
  meta?: { image_url?: string; est_hours?: number; icon?: string; order?: number };
};

export type HeroSlide = {
  id: string;
  title: string;
  subtitle: string;
  tags?: string[];
  stat?: string;
  buttonText: string;
  buttonLink: string;
  image?: string;
  variant: 'primary' | 'dark' | 'accent';
};

export function chapterCount(course: CatalogCourse): number {
  return course.chapter_count ?? course.item_count ?? 0;
}

export function courseDuration(course: CatalogCourse): string | null {
  if (course.duration_days) {
    const weeks = Math.max(1, Math.round(course.duration_days / 7));
    return weeks === 1 ? '1 week' : `${weeks} weeks`;
  }
  if (course.meta?.est_hours) return `${course.meta.est_hours} hrs`;
  return null;
}

export function courseDifficulty(course: CatalogCourse): string | null {
  const d = course.difficulty_level;
  if (!d) return null;
  return d.charAt(0).toUpperCase() + d.slice(1).toLowerCase();
}

export const DIFFICULTY_CLASSES: Record<string, string> = {
  beginner: 'bg-success/10 text-success border-success/20',
  intermediate: 'bg-primary/10 text-primary border-primary/20',
  advanced: 'bg-reward/10 text-reward border-reward/25',
};

export function difficultyClass(level?: string | null): string {
  return DIFFICULTY_CLASSES[(level || '').toLowerCase()] || 'bg-secondary text-muted-foreground border-border';
}

/** Deterministic accent index so covers stay stable per course. */
export function accentIndex(id: string, buckets = 4): number {
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) % 9973;
  return hash % buckets;
}

export const COVER_GRADIENTS = [
  'from-primary/85 via-primary/60 to-primary/25',
  'from-reward/80 via-reward/55 to-primary/25',
  'from-info/80 via-primary/55 to-reward/25',
  'from-success/70 via-primary/55 to-primary/20',
];

export function courseCover(course: CatalogCourse): string | null {
  return course.cover_image || course.meta?.image_url || null;
}

export function courseInitials(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

export function formatCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(count);
}

/** Search terms derived from the actual catalog, not a static list. */
export function derivedTopics(courses: CatalogCourse[], limit = 7): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of courses) {
    const word = (c.title || '').split(/[\s—–\-:]+/).filter((w) => w.length > 3)[0];
    if (word && !seen.has(word.toLowerCase())) {
      seen.add(word.toLowerCase());
      out.push(word);
    }
    if (out.length >= limit) break;
  }
  return out;
}
