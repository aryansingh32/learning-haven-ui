import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apprenticeshipService } from '@/services/apprenticeship.service';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ArrowRight, GraduationCap, Clock, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

export function ApprenticeshipOpportunities() {
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['jobs-apprenticeships', filterDifficulty],
    queryFn: () =>
      apprenticeshipService.getPrograms({
        difficulty: filterDifficulty === 'all' ? undefined : filterDifficulty,
      }),
  });

  const programs = (data?.programs || []).filter(
    (p: { title: string; description?: string }) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-48 rounded-2xl" />
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex flex-col md:flex-row gap-4">
        <motion.div className="relative flex-1 md:max-w-md" whileFocus={{ scale: 1.01 }}>
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search apprenticeships & programs..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </motion.div>
        <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            <SelectItem value="beginner">Beginner</SelectItem>
            <SelectItem value="intermediate">Intermediate</SelectItem>
            <SelectItem value="advanced">Advanced</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {programs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-40" />
          No apprenticeship programs published yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {programs.map((program: {
            id: string;
            slug: string;
            title: string;
            description?: string;
            difficulty?: string;
            duration_weeks?: number;
            enrolled_count?: number;
          }, idx: number) => (
            <motion.div
              key={program.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Link
                to={`/jobs/apprenticeships/${program.slug}`}
                className="group flex flex-col h-full rounded-2xl border border-border/50 bg-card p-5 hover:border-primary/30 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <Badge variant="outline" className="uppercase text-[10px] tracking-wider">
                    Apprenticeship
                  </Badge>
                  {program.difficulty && (
                    <Badge variant="secondary" className="capitalize text-[10px]">
                      {program.difficulty}
                    </Badge>
                  )}
                </div>
                <h3 className="text-lg font-bold font-display group-hover:text-primary transition-colors">
                  {program.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-3 flex-1">
                  {program.description}
                </p>
                <motion.div
                  className="mt-4 flex items-center justify-between text-xs text-muted-foreground"
                  whileHover={{ x: 2 }}
                >
                  <span className="flex items-center gap-3">
                    {program.duration_weeks != null && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {program.duration_weeks}w
                      </span>
                    )}
                    {program.enrolled_count != null && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> {program.enrolled_count}
                      </span>
                    )}
                  </span>
                  <span className="font-semibold text-primary flex items-center gap-1">
                    View program <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </motion.div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
