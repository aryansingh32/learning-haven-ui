import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apprenticeshipService } from '@/features/apprenticeship/api/apprenticeship.service';
import { ApprenticeshipCard, type ApprenticeshipCardData } from '@/features/apprenticeship/components/ApprenticeshipCard';
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, Search, CheckCircle2, Zap, Target } from "lucide-react";
import { tracker } from "@/lib/tracker";

export default function ApprenticeshipsPage() {
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    tracker.trackPageView({ page: 'apprenticeship_discovery' });
    return () => tracker.trackTimeOnPage({ page: 'apprenticeship_discovery' });
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["public-apprenticeships", { difficulty: filterDifficulty === 'all' ? undefined : filterDifficulty }],
    queryFn: () => apprenticeshipService.getPrograms({
      difficulty: filterDifficulty === 'all' ? undefined : filterDifficulty
    })
  });

  const programs = data?.programs || [];

  const filteredPrograms = programs.filter((p: any) => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl animate-fade-in fade-in-0 duration-500">
      
      {/* Hero Section */}
      <div className="text-center space-y-6 mb-16">
        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-4 py-1.5 text-sm uppercase tracking-wider backdrop-blur-md">
          <Zap className="h-4 w-4 mr-2" /> Guaranteed Practical Experience
        </Badge>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
          Build Real Projects.<br />
          <span className="bg-gradient-to-r from-[hsl(234,89%,63%)] to-[hsl(258,90%,66%)] bg-clip-text text-transparent">Get Verified Automatically.</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          Don't just watch tutorials. Build production-grade software following professional requirements. Every push to GitHub is automatically tested. 
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-12 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search programs (e.g. Full-Stack)..." 
            className="pl-10 bg-background/50 backdrop-blur-md border border-primary/10 hover:border-primary/30 transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
            <SelectTrigger className="w-[180px] bg-background/50 backdrop-blur-md">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="beginner">Beginner Friendly</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Programs Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-[400px] rounded-2xl bg-muted/20 animate-pulse border border-border" />
          ))}
        </div>
      ) : filteredPrograms.length === 0 ? (
        <div className="text-center py-24 bg-card/10 border border-dashed rounded-3xl backdrop-blur-sm">
          <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-semibold mb-2">No programs found</h3>
          <p className="text-muted-foreground">Try adjusting your search criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {(filteredPrograms as ApprenticeshipCardData[]).map((program, i) => (
            <ApprenticeshipCard key={program.id} program={program} index={i} />
          ))}
        </div>
      )}

      {/* Feature Highlights */}
      <div className="mt-24 grid md:grid-cols-3 gap-8 py-12 border-t border-primary/10">
        <div className="space-y-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <h4 className="font-bold text-lg">Automated Code Review</h4>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Every submission is tested against rigorous integration test suites that run in sandboxed Docker containers.
          </p>
        </div>
        <div className="space-y-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Briefcase className="h-5 w-5" />
          </div>
          <h4 className="font-bold text-lg">Portfolio Ready Projects</h4>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Build real systems. You'll finish with production-grade code on your GitHub built from empty repositories.
          </p>
        </div>
        <div className="space-y-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Target className="h-5 w-5" />
          </div>
          <h4 className="font-bold text-lg">Verifiable Credentials</h4>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Earn a dynamic certificate linked to your cryptographic proof of work and open source commits.
          </p>
        </div>
      </div>
    </div>
  );
}
