import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../services/admin.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Save, Trophy, Target, Award } from 'lucide-react';
import { toast } from 'sonner';

type GamificationConfig = {
  identity_titles: Array<{ id: string; minLevel: number; maxLevel: number; title: string; requiredChapterTags: string[] }>;
  badges: Array<{ id: string; name: string; emoji: string; topicTag: string; solveCount: number }>;
  daily_quest_templates: Array<{ key: string; label: string; xp: number }>;
  daily_quest_bonus_xp: number;
  weekly_goal_problems: number;
  monthly_goal_label: string;
};

const DEFAULT_CONFIG: GamificationConfig = {
  identity_titles: [],
  badges: [],
  daily_quest_templates: [],
  daily_quest_bonus_xp: 50,
  weekly_goal_problems: 10,
  monthly_goal_label: 'Finish current module',
};

const GamificationSettings = () => {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<GamificationConfig>(DEFAULT_CONFIG);
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: adminService.getSettings,
  });

  useEffect(() => {
    const settings = typeof data === 'object' ? (data.settings ?? data) : {};
    const raw = settings.gamification_config;
    if (raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      setConfig({ ...DEFAULT_CONFIG, ...parsed });
      setJsonText(JSON.stringify(parsed, null, 2));
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: (cfg: GamificationConfig) =>
      adminService.updateSettings({ gamification_config: cfg }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      toast.success('Gamification settings saved');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || e.message),
  });

  const updateIdentity = (index: number, field: string, value: string | number) => {
    setConfig((prev) => {
      const titles = [...prev.identity_titles];
      titles[index] = { ...titles[index], [field]: value };
      return { ...prev, identity_titles: titles };
    });
  };

  const updateBadge = (index: number, field: string, value: string | number) => {
    setConfig((prev) => {
      const badges = [...prev.badges];
      badges[index] = { ...badges[index], [field]: value };
      return { ...prev, badges: badges };
    });
  };

  const updateQuest = (index: number, field: string, value: string | number) => {
    setConfig((prev) => {
      const quests = [...prev.daily_quest_templates];
      quests[index] = { ...quests[index], [field]: value };
      return { ...prev, daily_quest_templates: quests };
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gamification Settings</h2>
          <p className="text-muted-foreground mt-1">
            Configure identity titles, badges, daily quests, and retention loops
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-0.5 bg-accent rounded-lg p-0.5">
            <button
              onClick={() => setJsonMode(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                !jsonMode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Trophy className="w-3 h-3" /> Visual
            </button>
            <button
              onClick={() => {
                setJsonMode(true);
                setJsonText(JSON.stringify(config, null, 2));
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                jsonMode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              JSON
            </button>
          </div>
          <Button
            onClick={() => saveMut.mutate(jsonMode ? JSON.parse(jsonText) : config)}
            disabled={saveMut.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {saveMut.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {jsonMode ? (
        <Card>
          <CardHeader>
            <CardTitle>gamification_config (JSON)</CardTitle>
            <CardDescription>Stored in system_settings table</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              className="font-mono text-sm min-h-[480px]"
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Trophy className="w-4 h-4" /> Identity Titles</CardTitle>
              <CardDescription>Hybrid XP level + chapter milestone titles shown in sidebar and dashboard</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {config.identity_titles.map((title, i) => (
                <div key={title.id} className="grid gap-3 md:grid-cols-4 p-4 rounded-lg border bg-muted/30">
                  <div>
                    <Label className="text-xs">Title</Label>
                    <Input value={title.title} onChange={(e) => updateIdentity(i, 'title', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Min Level</Label>
                    <Input type="number" value={title.minLevel} onChange={(e) => updateIdentity(i, 'minLevel', Number(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-xs">Max Level</Label>
                    <Input type="number" value={title.maxLevel} onChange={(e) => updateIdentity(i, 'maxLevel', Number(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-xs">Required Tags (comma-separated)</Label>
                    <Input
                      value={(title.requiredChapterTags || []).join(', ')}
                      onChange={(e) =>
                        setConfig((prev) => {
                          const titles = [...prev.identity_titles];
                          titles[i] = { ...titles[i], requiredChapterTags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) };
                          return { ...prev, identity_titles: titles };
                        })
                      }
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Award className="w-4 h-4" /> Achievement Badges</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {config.badges.map((badge, i) => (
                <div key={badge.id} className="grid gap-3 md:grid-cols-5 p-4 rounded-lg border bg-muted/30">
                  <div>
                    <Label className="text-xs">Emoji</Label>
                    <Input value={badge.emoji} onChange={(e) => updateBadge(i, 'emoji', e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">Name</Label>
                    <Input value={badge.name} onChange={(e) => updateBadge(i, 'name', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Topic Tag</Label>
                    <Input value={badge.topicTag} onChange={(e) => updateBadge(i, 'topicTag', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Solve Count</Label>
                    <Input type="number" value={badge.solveCount} onChange={(e) => updateBadge(i, 'solveCount', Number(e.target.value))} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Target className="w-4 h-4" /> Daily Quests & Goals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>Daily Bonus XP</Label>
                  <Input
                    type="number"
                    value={config.daily_quest_bonus_xp}
                    onChange={(e) => setConfig((p) => ({ ...p, daily_quest_bonus_xp: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label>Weekly Goal (problems)</Label>
                  <Input
                    type="number"
                    value={config.weekly_goal_problems}
                    onChange={(e) => setConfig((p) => ({ ...p, weekly_goal_problems: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label>Monthly Goal Label</Label>
                  <Input
                    value={config.monthly_goal_label}
                    onChange={(e) => setConfig((p) => ({ ...p, monthly_goal_label: e.target.value }))}
                  />
                </div>
              </div>
              {config.daily_quest_templates.map((quest, i) => (
                <div key={quest.key} className="grid gap-3 md:grid-cols-3 p-4 rounded-lg border bg-muted/30">
                  <div>
                    <Label className="text-xs">Key</Label>
                    <Input value={quest.key} disabled />
                  </div>
                  <div>
                    <Label className="text-xs">Label</Label>
                    <Input value={quest.label} onChange={(e) => updateQuest(i, 'label', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">XP</Label>
                    <Input type="number" value={quest.xp} onChange={(e) => updateQuest(i, 'xp', Number(e.target.value))} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default GamificationSettings;
