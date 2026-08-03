import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { buildHavenService } from '@/features/build-haven/api/build-haven.service';
import { BuildDifficultyBadge } from '@/features/build-haven/components/BuildDifficultyBadge';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Hammer, Search, GitBranch, Terminal, Sparkles, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const DIFFICULTIES = ['', 'beginner', 'intermediate', 'advanced'] as const;
const LANGUAGES = ['', 'python', 'javascript', 'java', 'go', 'rust', 'c', 'cpp'] as const;

export default function ProjectsPage() {
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [language, setLanguage] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['build-catalog', difficulty, language],
    queryFn: () =>
      buildHavenService.listChallenges({
        status: 'live',
        ...(difficulty ? { difficulty } : {}),
        ...(language ? { language } : {}),
      }),
  });

  const challenges = useMemo(() => {
    const list = data?.challenges || [];
    const q = query.toLowerCase().trim();
    if (!q) return list;
    return list.filter((item: { title: string; description?: string; short_tagline?: string }) =>
      `${item.title} ${item.description || ''} ${item.short_tagline || ''}`.toLowerCase().includes(q)
    );
  }, [data?.challenges, query]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-7xl space-y-8 pb-20 md:pb-8"
    >
      <section className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-card via-background to-primary/5 p-8 md:p-10 shadow-xl">
        <motion.div
          className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 6, repeat: Infinity }}
        />
        <div className="relative z-10 space-y-4">
          <Badge className="border-primary/30 bg-primary/10 text-primary uppercase tracking-wider">
            <Hammer className="mr-1.5 h-3.5 w-3.5" />
            Build your own X
          </Badge>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Ship real systems.
            <br />
            <span className="text-gradient-golden">One stage at a time.</span>
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            CodeCrafters-style challenges: clone a repo, implement each stage locally, push to GitHub, and get
            instant Docker verification with live logs — all inside Learning Haven.
          </p>
          <div className="flex flex-wrap gap-4 pt-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-primary" /> Git push workflow
            </span>
            <span className="inline-flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5 text-primary" /> Multi-language starters
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Per-stage test runner
            </span>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects (Shell, Redis, Git…)"
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={difficulty || 'all'} onValueChange={(v) => setDifficulty(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              {DIFFICULTIES.filter(Boolean).map((d) => (
                <SelectItem key={d} value={d} className="capitalize">
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={language || 'all'} onValueChange={(v) => setLanguage(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All languages</SelectItem>
              {LANGUAGES.filter(Boolean).map((lang) => (
                <SelectItem key={lang} value={lang} className="capitalize">
                  {lang}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(difficulty || language || query) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery('');
                setDifficulty('');
                setLanguage('');
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading projects…</div>
      ) : challenges.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          No challenges match your filters. Admins can publish build challenges from the admin panel.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {challenges.map(
            (
              challenge: {
                id: string;
                slug: string;
                title: string;
                description?: string;
                short_tagline?: string;
                difficulty_level?: string;
                supported_languages?: string[];
                stages_count?: number;
                is_free?: boolean;
              },
              i: number
            ) => (
              <motion.div
                key={challenge.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link
                  to={`/projects/${challenge.slug}`}
                  className={cn(
                    'group flex h-full flex-col rounded-2xl border border-border/60 bg-card/80 p-5',
                    'transition-all hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-lg font-bold text-foreground transition-colors group-hover:text-primary">
                      {challenge.title}
                    </h3>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                  {challenge.short_tagline ? (
                    <p className="mt-1 text-xs text-primary/90 line-clamp-1">{challenge.short_tagline}</p>
                  ) : null}
                  <p className="mt-2 flex-1 text-sm text-muted-foreground line-clamp-3">
                    {challenge.description}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <BuildDifficultyBadge difficulty={challenge.difficulty_level} />
                    {challenge.is_free ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Free
                      </Badge>
                    ) : null}
                    {challenge.stages_count ? (
                      <span className="text-[10px] text-muted-foreground">{challenge.stages_count} stages</span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {(challenge.supported_languages || []).slice(0, 4).map((lang: string) => (
                      <Badge key={lang} variant="outline" className="text-[10px] capitalize">
                        {lang}
                      </Badge>
                    ))}
                  </div>
                </Link>
              </motion.div>
            )
          )}
        </div>
      )}
    </motion.div>
  );
}
