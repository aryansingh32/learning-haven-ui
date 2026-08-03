import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { buildHavenAdminApi } from '../services/build-haven.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// Reusable preview component matching the web app UI
function TestimonialsPreview({ config }: { config: any }) {
  const items = config?.items || [];
  
  if (items.length === 0) {
    return <div className="text-muted-foreground italic text-sm">No testimonials added yet.</div>;
  }

  // Preview only the first 2 items to match the web app grid
  const previewItems = items.slice(0, 2);

  return (
    <div className="grid gap-x-8 gap-y-12 md:grid-cols-2 bg-[#05050f] p-8 rounded-lg">
      {previewItems.map((t: any, idx: number) => (
        <div key={idx} className="relative border-l border-white/10 pl-6 py-1">
          <div className="flex gap-4 mb-6">
            <div className="flex-shrink-0 text-[#6366f1] mt-0.5">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h4v10h-10z" />
              </svg>
            </div>
            <p className="text-[15px] leading-relaxed text-gray-300">
              {t.text || "Testimonial text goes here..."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <img
              src={t.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.author_name || 'User')}&background=random`}
              alt={t.author_name}
              className="h-10 w-10 rounded-full object-cover border border-white/10"
            />
            <div>
              <p className="text-sm font-semibold text-white">
                {t.author_name || "Author Name"}
              </p>
              <p className="text-xs text-gray-400">{t.author_title || "Author Title"}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProjectFeedbackTab() {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const { data: challengesData, isLoading: isLoadingChallenges } = useQuery({
    queryKey: ['admin-challenges'],
    queryFn: () => buildHavenAdminApi.listChallenges(),
  });

  const challenges = challengesData?.challenges || [];
  const selectedProject = challenges.find((c: any) => c.id === selectedProjectId);

  const { data: projectDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['admin-challenge', selectedProjectId],
    queryFn: () => buildHavenAdminApi.getChallenge(selectedProjectId),
    enabled: !!selectedProjectId,
  });

  const [config, setConfig] = useState<{ auto_slide: boolean; items: any[] }>({
    auto_slide: false,
    items: [],
  });

  React.useEffect(() => {
    if (projectDetails?.challenge?.testimonials_config) {
      setConfig(projectDetails.challenge.testimonials_config);
    } else {
      setConfig({ auto_slide: false, items: [] });
    }
  }, [projectDetails]);

  const updateMut = useMutation({
    mutationFn: (newConfig: any) =>
      buildHavenAdminApi.updateChallenge(selectedProjectId, { testimonials_config: newConfig }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-challenge', selectedProjectId] });
      toast.success('Project feedback configured successfully');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || e.message),
  });

  const handleSave = () => {
    if (!selectedProjectId) return;
    updateMut.mutate(config);
  };

  const addItem = () => {
    setConfig({
      ...config,
      items: [
        ...config.items,
        { id: Date.now().toString(), text: '', author_name: '', author_title: '', author_avatar: '', link: '' },
      ],
    });
  };

  const removeItem = (index: number) => {
    const newItems = [...config.items];
    newItems.splice(index, 1);
    setConfig({ ...config, items: newItems });
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...config.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setConfig({ ...config, items: newItems });
  };

  if (isLoadingChallenges) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 mt-4">
      <div className="flex gap-4 items-center">
        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Select a project..." />
          </SelectTrigger>
          <SelectContent>
            {challenges.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedProjectId && (
          <Button onClick={handleSave} disabled={updateMut.isPending}>
            {updateMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Configuration
          </Button>
        )}
      </div>

      {selectedProjectId && isLoadingDetails ? (
        <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : selectedProjectId ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Editor Side */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex justify-between items-center">
                  <span>General Settings</span>
                  <div className="flex items-center space-x-2 text-sm font-normal">
                    <Label htmlFor="auto-slide">Auto Slide</Label>
                    <Switch
                      id="auto-slide"
                      checked={config.auto_slide}
                      onCheckedChange={(c) => setConfig({ ...config, auto_slide: c })}
                    />
                  </div>
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Testimonial Items</CardTitle>
                <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-4 w-4 mr-1" /> Add</Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {config.items.map((item, idx) => (
                  <div key={item.id || idx} className="border border-border p-4 rounded-md space-y-4 relative">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-2 right-2 text-destructive hover:bg-destructive/10"
                      onClick={() => removeItem(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <div className="space-y-2">
                      <Label>Testimonial Text</Label>
                      <Textarea 
                        value={item.text} 
                        onChange={(e) => updateItem(idx, 'text', e.target.value)} 
                        rows={3} 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Author Name</Label>
                        <Input 
                          value={item.author_name} 
                          onChange={(e) => updateItem(idx, 'author_name', e.target.value)} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Author Title</Label>
                        <Input 
                          value={item.author_title} 
                          onChange={(e) => updateItem(idx, 'author_title', e.target.value)} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Avatar URL (optional)</Label>
                        <Input 
                          value={item.author_avatar || ''} 
                          onChange={(e) => updateItem(idx, 'author_avatar', e.target.value)} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Link (optional)</Label>
                        <Input 
                          value={item.link || ''} 
                          onChange={(e) => updateItem(idx, 'link', e.target.value)} 
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {config.items.length === 0 && (
                  <div className="text-center text-muted-foreground p-4 border border-dashed rounded-md">
                    No testimonials configured. Click Add to create one.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Preview Side */}
          <div className="space-y-6">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="text-lg">Live Preview</CardTitle>
                <p className="text-sm text-muted-foreground">This is how it will roughly look on the dark-mode overview page.</p>
              </CardHeader>
              <CardContent>
                <TestimonialsPreview config={config} />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Select a project from the dropdown to configure its testimonials.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
