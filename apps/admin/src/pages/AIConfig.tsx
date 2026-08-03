import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../services/admin.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Save, Bot, Eye, Code, AlertCircle, Plus, X, Zap, ArrowRight, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

type EditorMode = 'visual' | 'rules' | 'json';

interface Rule {
  id: string;
  condition: string;
  conditionValue: string;
  action: string;
  actionValue: string;
  enabled: boolean;
}

const CONDITION_OPTIONS = [
  'User inactive for (days)',
  'Proficiency below (%)',
  'Streak broken',
  'Failed quiz (count)',
  'Chapter completion < (%)',
  'No AI usage for (days)',
  'User tier is',
];

const ACTION_OPTIONS = [
  'Show comeback challenge',
  'Send notification',
  'Recommend topic',
  'Offer discount',
  'Award bonus XP',
  'Trigger AI mentor check-in',
  'Suggest career path',
];

const AIConfig = () => {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<Record<string, any>>({});
  const [mode, setMode] = useState<EditorMode>('visual');
  const [jsonRaw, setJsonRaw] = useState('{}');
  const [jsonError, setJsonError] = useState('');
  const [rules, setRules] = useState<Rule[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['ai-config'],
    queryFn: adminService.getAIConfig,
  });

  useEffect(() => {
    if (data) {
      const cfg = typeof data === 'object' ? (data.config ?? data) : {};
      setConfig(cfg);
      setJsonRaw(JSON.stringify(cfg, null, 2));
      // Extract rules from config if they exist
      if (cfg.intervention_rules && Array.isArray(cfg.intervention_rules)) {
        setRules(cfg.intervention_rules);
      }
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: (cfg: Record<string, any>) => adminService.updateAIConfig(cfg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-config'] });
      toast.success('AI configuration saved');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || e.message),
  });

  const handleChange = (key: string, value: any) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (mode === 'json') {
      try {
        saveMut.mutate(JSON.parse(jsonRaw));
        setJsonError('');
      } catch {
        setJsonError('Invalid JSON');
      }
    } else {
      saveMut.mutate({ ...config, intervention_rules: rules });
    }
  };

  // Rule builder helpers
  const addRule = () => {
    setRules([...rules, {
      id: Date.now().toString(),
      condition: CONDITION_OPTIONS[0],
      conditionValue: '5',
      action: ACTION_OPTIONS[0],
      actionValue: '100',
      enabled: true,
    }]);
  };

  const updateRule = (id: string, field: keyof Rule, value: any) => {
    setRules(rules.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const removeRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">AI Configuration</h2>
          <p className="text-muted-foreground mt-1">Configure AI assistant settings</p>
        </div>
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  const keys = Object.keys(config).filter(k => !k.startsWith('_') && k !== 'id' && k !== 'intervention_rules');

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">AI Configuration</h2>
          <p className="text-muted-foreground mt-1">Configure AI behavior, prompts, and intervention rules</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode Toggle */}
          <div className="flex items-center gap-0.5 bg-accent rounded-lg p-0.5">
            {(['visual', 'rules', 'json'] as EditorMode[]).map(m => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  if (m === 'json') setJsonRaw(JSON.stringify({ ...config, intervention_rules: rules }, null, 2));
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  mode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {m === 'visual' && <Eye className="w-3 h-3" />}
                {m === 'rules' && <Zap className="w-3 h-3" />}
                {m === 'json' && <Code className="w-3 h-3" />}
                {m === 'visual' ? 'Parameters' : m === 'rules' ? 'Rules' : 'JSON'}
              </button>
            ))}
          </div>
          <Button onClick={handleSave} disabled={saveMut.isPending}>
            {saveMut.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            <Save className="mr-2 h-4 w-4" /> Save
          </Button>
        </div>
      </div>

      {mode === 'visual' && (
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              AI Parameters
            </CardTitle>
            <CardDescription>Adjust how the AI assistant operates for users</CardDescription>
          </CardHeader>
          <CardContent>
            {keys.length === 0 ? (
              <p className="text-sm text-muted-foreground">No AI configuration available. Add parameters or switch to JSON mode.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {keys.map((key) => {
                  const val = config[key];
                  const isObject = typeof val === 'object' && val !== null;
                  const isBoolean = typeof val === 'boolean';

                  return (
                    <div key={key} className={`space-y-1.5 ${isObject ? 'md:col-span-2' : ''}`}>
                      <Label className="text-xs font-medium capitalize">{key.replace(/_/g, ' ')}</Label>
                      {isObject ? (
                        <Textarea
                          value={JSON.stringify(val, null, 2)}
                          onChange={(e) => { try { handleChange(key, JSON.parse(e.target.value)); } catch { /* keep editing */ } }}
                          className="font-mono text-xs min-h-[80px] bg-accent/20"
                        />
                      ) : isBoolean ? (
                        <div className="flex items-center gap-2">
                          <Switch checked={val} onCheckedChange={(v) => handleChange(key, v)} />
                          <span className="text-xs text-muted-foreground">{val ? 'Enabled' : 'Disabled'}</span>
                        </div>
                      ) : typeof val === 'number' ? (
                        <Input type="number" value={val} onChange={(e) => handleChange(key, Number(e.target.value))} />
                      ) : (
                        <Input value={val?.toString() || ''} onChange={(e) => handleChange(key, e.target.value)} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {mode === 'rules' && (
        <div className="space-y-4">
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Intervention Rules
                </CardTitle>
                <CardDescription>Create IF/THEN rules for automated AI interventions</CardDescription>
              </div>
              <Button size="sm" onClick={addRule}>
                <Plus className="w-3 h-3 mr-1" /> Add Rule
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {rules.length === 0 ? (
                <div className="text-center py-10">
                  <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm text-muted-foreground">No rules configured. Click "Add Rule" to create one.</p>
                </div>
              ) : (
                rules.map((rule, i) => (
                  <div key={rule.id} className={`rounded-xl border p-4 transition-all ${rule.enabled ? 'bg-background' : 'bg-accent/30 opacity-60'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Rule #{i + 1}</span>
                      <div className="flex items-center gap-2">
                        <Switch checked={rule.enabled} onCheckedChange={(v) => updateRule(rule.id, 'enabled', v)} />
                        <button onClick={() => removeRule(rule.id)} className="text-muted-foreground hover:text-destructive">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">IF</span>
                      <select
                        value={rule.condition}
                        onChange={(e) => updateRule(rule.id, 'condition', e.target.value)}
                        className="flex-1 min-w-[180px] h-9 rounded-md border border-input bg-background px-3 text-xs"
                      >
                        {CONDITION_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <Input
                        value={rule.conditionValue}
                        onChange={(e) => updateRule(rule.id, 'conditionValue', e.target.value)}
                        className="w-20 text-xs text-center"
                        placeholder="Value"
                      />
                    </div>

                    <div className="flex items-center justify-center my-2">
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">THEN</span>
                      <select
                        value={rule.action}
                        onChange={(e) => updateRule(rule.id, 'action', e.target.value)}
                        className="flex-1 min-w-[180px] h-9 rounded-md border border-input bg-background px-3 text-xs"
                      >
                        {ACTION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                      <Input
                        value={rule.actionValue}
                        onChange={(e) => updateRule(rule.id, 'actionValue', e.target.value)}
                        className="w-20 text-xs text-center"
                        placeholder="Value"
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {mode === 'json' && (
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Code className="w-4 h-4 text-primary" />
              Raw JSON
            </CardTitle>
            <CardDescription className="flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3" /> Advanced — edit the complete AI configuration JSON
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={jsonRaw}
              onChange={(e) => { setJsonRaw(e.target.value); setJsonError(''); }}
              className="font-mono text-xs min-h-[400px] bg-accent/20"
              spellCheck={false}
            />
            {jsonError && (
              <p className="mt-2 text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {jsonError}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AIConfig;
