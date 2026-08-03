import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../services/admin.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Save, Settings as SettingsIcon, Eye, Code, AlertCircle, Plus, X, Palette, Globe, Mail, Bell, Shield } from 'lucide-react';
import { toast } from 'sonner';

type EditorMode = 'visual' | 'json';

/** Categorize known setting keys into logical sections */
const SETTING_SECTIONS: Record<string, { label: string; icon: any; keys: string[] }> = {
  branding: {
    label: 'Branding & Appearance',
    icon: Palette,
    keys: ['hero_title', 'hero_subtitle', 'primary_color', 'app_name', 'logo_url', 'favicon_url', 'og_image'],
  },
  platform: {
    label: 'Platform Configuration',
    icon: Globe,
    keys: ['trending_categories', 'default_course', 'signup_bonus_xp', 'max_daily_xp', 'maintenance_mode', 'allow_signups'],
  },
  notifications: {
    label: 'Notifications & Email',
    icon: Mail,
    keys: ['welcome_email_template', 'referral_email_template', 'notification_webhook_url', 'support_email'],
  },
  security: {
    label: 'Security & Limits',
    icon: Shield,
    keys: ['max_login_attempts', 'session_timeout_hours', 'rate_limit_per_minute', 'fraud_detection_enabled'],
  },
};

const Settings = () => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [mode, setMode] = useState<EditorMode>('visual');
  const [jsonRaw, setJsonRaw] = useState('{}');
  const [jsonError, setJsonError] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: adminService.getSettings,
  });

  useEffect(() => {
    if (data) {
      const settings = typeof data === 'object' ? (data.settings ?? data) : {};
      setFormData(settings);
      setJsonRaw(JSON.stringify(settings, null, 2));
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: (settings: Record<string, any>) => adminService.updateSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      toast.success('Settings saved successfully');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || e.message),
  });

  const handleChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (mode === 'json') {
      try {
        const parsed = JSON.parse(jsonRaw);
        setJsonError('');
        saveMut.mutate(parsed);
      } catch {
        setJsonError('Invalid JSON — fix syntax before saving');
      }
    } else {
      saveMut.mutate(formData);
    }
  };

  const addNewSetting = () => {
    if (!newKey.trim()) return;
    handleChange(newKey.trim(), newValue || '');
    setNewKey('');
    setNewValue('');
    toast.success(`Added setting: ${newKey}`);
  };

  const removeSetting = (key: string) => {
    const updated = { ...formData };
    delete updated[key];
    setFormData(updated);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Settings</h2>
          <p className="text-muted-foreground mt-1">Configure platform-wide settings</p>
        </div>
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  const allKeys = Object.keys(formData).filter(k => !k.startsWith('_'));

  // Categorize keys
  const categorized = new Set<string>();
  const sections = Object.entries(SETTING_SECTIONS).map(([id, section]) => {
    const matchedKeys = section.keys.filter(k => allKeys.includes(k));
    matchedKeys.forEach(k => categorized.add(k));
    return { ...section, id, matchedKeys };
  }).filter(s => s.matchedKeys.length > 0);

  const uncategorizedKeys = allKeys.filter(k => !categorized.has(k));

  const renderVisualField = (key: string) => {
    const val = formData[key];
    const isObject = typeof val === 'object' && val !== null;
    const isBoolean = typeof val === 'boolean';
    const isColor = key.includes('color') && typeof val === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(val);

    return (
      <div key={key} className={`space-y-1.5 ${isObject ? 'md:col-span-2' : ''}`}>
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium capitalize">{key.replace(/_/g, ' ')}</Label>
          <button onClick={() => removeSetting(key)} className="text-muted-foreground hover:text-destructive transition-colors">
            <X className="w-3 h-3" />
          </button>
        </div>
        {isObject ? (
          <Textarea
            value={JSON.stringify(val, null, 2)}
            onChange={(e) => {
              try { handleChange(key, JSON.parse(e.target.value)); } catch { /* keep editing */ }
            }}
            className="font-mono text-xs min-h-[80px] bg-accent/20"
          />
        ) : isBoolean ? (
          <div className="flex items-center gap-2">
            <Switch checked={val} onCheckedChange={(v) => handleChange(key, v)} />
            <span className="text-xs text-muted-foreground">{val ? 'Enabled' : 'Disabled'}</span>
          </div>
        ) : isColor ? (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={val}
              onChange={(e) => handleChange(key, e.target.value)}
              className="w-10 h-9 rounded-md border cursor-pointer"
            />
            <Input value={val} onChange={(e) => handleChange(key, e.target.value)} className="flex-1 font-mono text-xs" />
          </div>
        ) : (
          <Input
            value={val?.toString() || ''}
            onChange={(e) => handleChange(key, e.target.value)}
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Settings</h2>
          <p className="text-muted-foreground mt-1">Configure platform-wide settings</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode Toggle */}
          <div className="flex items-center gap-1 bg-accent rounded-lg p-0.5">
            <button
              onClick={() => setMode('visual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                mode === 'visual' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <Eye className="w-3 h-3" /> Visual
            </button>
            <button
              onClick={() => {
                setMode('json');
                setJsonRaw(JSON.stringify(formData, null, 2));
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                mode === 'json' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <Code className="w-3 h-3" /> JSON
            </button>
          </div>

          <Button onClick={handleSave} disabled={saveMut.isPending}>
            {saveMut.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            {saveMut.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {mode === 'visual' ? (
        <>
          {/* Categorized Sections */}
          {sections.map((section) => {
            const SectionIcon = section.icon;
            return (
              <Card key={section.id} className="border-0 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <SectionIcon className="w-4 h-4 text-primary" />
                    {section.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {section.matchedKeys.map(renderVisualField)}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Uncategorized */}
          {uncategorizedKeys.length > 0 && (
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <SettingsIcon className="w-4 h-4 text-primary" />
                  Other Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {uncategorizedKeys.map(renderVisualField)}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Add New Setting */}
          <Card className="border-dashed border-2 shadow-none">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                <Plus className="w-3 h-3" /> Add New Setting
              </p>
              <div className="flex gap-2">
                <Input
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="Setting key (e.g. max_daily_xp)"
                  className="flex-1 font-mono text-xs"
                />
                <Input
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="Value"
                  className="flex-1 text-xs"
                />
                <Button size="sm" onClick={addNewSetting} disabled={!newKey.trim()}>
                  <Plus className="w-3 h-3 mr-1" /> Add
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        /* JSON Mode */
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Code className="w-4 h-4 text-primary" />
              Raw JSON Configuration
            </CardTitle>
            <CardDescription className="flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3" />
              Advanced — edit the complete settings JSON directly
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
              <p className="mt-2 text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {jsonError}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Settings;
