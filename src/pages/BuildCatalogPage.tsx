import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { buildHavenService } from '@/services/build-haven.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

export default function BuildCatalogPage() {
  const [query, setQuery] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['build-catalog'],
    queryFn: () => buildHavenService.listChallenges({ status: 'live' }),
  });

  const challenges = (data?.challenges || []).filter((item: any) =>
    `${item.title} ${item.description || ''}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="container mx-auto max-w-6xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Build Haven</h1>
        <p className="text-muted-foreground mt-2">Build your own X with stage-by-stage Git push verification.</p>
      </div>
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search build challenges..." />
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading challenges...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {challenges.map((challenge: any) => (
            <Link key={challenge.id} to={`/projects/${challenge.slug}`}>
              <Card className="h-full hover:border-primary/40 transition-colors">
                <CardHeader>
                  <CardTitle>{challenge.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-3">{challenge.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {(challenge.supported_languages || []).map((language: string) => (
                      <Badge key={language} variant="secondary">{language}</Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="capitalize">{challenge.difficulty_level}</Badge>
                    <span className="text-xs text-muted-foreground">{challenge.stages_count || 0} stages</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
