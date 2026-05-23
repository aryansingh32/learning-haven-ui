import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apprenticeshipService } from "@/services/apprenticeship.service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, Search, ArrowRight, CheckCircle2, ChevronRight, Zap, Target } from "lucide-react";
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredPrograms.map((program: any) => (
            <Link 
              key={program.id} 
              to={`/jobs/apprenticeships/${program.slug}`}
              onClick={() => tracker.track('program_page_viewed', { program_id: program.id, slug: program.slug })}
              className="group relative flex flex-col justify-between bg-card hover:bg-accent/5 transition-all duration-300 border border-primary/10 hover:border-primary/30 rounded-3xl p-8 hover:shadow-2xl hover:shadow-primary/5 overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity duration-500 scale-150 -translate-y-10 translate-x-10 pointer-events-none">
                <Briefcase className="w-32 h-32" />
              </div>
              
              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="capitalize bg-background/50 backdrop-blur">
                    {program.difficulty_level}
                  </Badge>
                  <span className="text-sm font-medium text-muted-foreground">
                    {program.total_projects} Projects
                  </span>
                </div>
                
                <div>
                  <h3 className="text-2xl font-bold mb-2 group-hover:text-primary transition-colors">
                    {program.title}
                  </h3>
                  <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">
                    {program.description}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {program.tech_stack?.slice(0, 3).map((tech: string) => (
                    <Badge key={tech} variant="secondary" className="bg-primary/5 text-primary hover:bg-primary/10">
                      {tech}
                    </Badge>
                  ))}
                  {program.tech_stack?.length > 3 && (
                    <span className="text-xs text-muted-foreground font-medium self-center">
                      +{program.tech_stack.length - 3} more
                    </span>
                  )}
                </div>
              </div>

              <div className="relative z-10 pt-8 mt-auto border-t border-primary/10 group-hover:border-primary/20 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-muted-foreground font-medium">Estimated Time</div>
                  <div className="text-sm font-bold flex items-center">
                    <Target className="h-4 w-4 mr-2 text-primary" /> {program.duration_days} Days
                  </div>
                </div>
                
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-2xl font-black">₹{(program.price_inr / 100).toLocaleString('en-IN')}</span>
                      {program.original_price_inr && (
                        <span className="text-sm text-muted-foreground line-through ml-2">
                          ₹{(program.original_price_inr / 100).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button className="w-full justify-between group/btn bg-primary hover:bg-primary/90 text-primary-foreground transition-all">
                    View Details
                    <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </div>
            </Link>
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
