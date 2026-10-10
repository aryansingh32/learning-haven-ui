import { FromYourCollegeSeries } from '@/components/college/FromYourCollege';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Loader2, Clock, Lock, ArrowRight } from 'lucide-react';
import { fetchCatalog } from '@/data/testSeries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

export default function TestSeriesCatalogPage() {
  const navigate = useNavigate();
  const { data: categories, isLoading } = useQuery({ queryKey: ['test-series-catalog'], queryFn: fetchCatalog });

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Test Series</h1>
        <p className="text-muted-foreground mt-1">
          Exam-style mock tests with negative marking, sectional timing, and full analytics — attempt free tests
          instantly, or unlock a series.
        </p>
      </div>

      <FromYourCollegeSeries />

      {isLoading ? (
        <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !categories?.length ? (
        <p className="text-muted-foreground text-center py-24">No test series are published yet — check back soon.</p>
      ) : (
        <Accordion type="multiple" defaultValue={categories.map((c) => c.id)} className="space-y-4">
          {categories.map((category) => (
            <AccordionItem key={category.id} value={category.id} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  {category.iconUrl && <span>{category.iconUrl}</span>}
                  {category.name}
                  <Badge variant="outline" className="ml-2 font-normal">{category.series.length} series</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                {category.series.map((series) => (
                  <Card key={series.id} className="border-0 shadow-sm bg-muted/30">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base">{series.title} {series.year ? `(${series.year})` : ''}</CardTitle>
                          {series.description && <p className="text-sm text-muted-foreground mt-1">{series.description}</p>}
                        </div>
                        {series.isFree ? <Badge variant="secondary">Free</Badge> : <Badge variant="outline">₹{series.price}</Badge>}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {series.tests.map((test) => {
                        const locked = !series.isFree && !test.isFree;
                        return (
                          <div key={test.id} className="flex items-center justify-between gap-3 rounded-md border bg-background p-3">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{test.title}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Clock className="h-3 w-3" /> {formatDuration(test.durationSeconds)}
                                {test.isSectional && <Badge variant="outline" className="ml-1 py-0 text-[10px]">Sectional</Badge>}
                                {test.isFree && <Badge variant="secondary" className="ml-1 py-0 text-[10px]">Free</Badge>}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant={locked ? 'outline' : 'default'}
                              disabled={locked}
                              onClick={() => navigate(`/test-series/tests/${test.id}`)}
                            >
                              {locked ? <><Lock className="mr-1.5 h-3.5 w-3.5" /> Locked</> : <>Start <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></>}
                            </Button>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
