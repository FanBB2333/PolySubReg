import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { settingsItem } from '@/lib/storage';
import { DEFAULT_SETTINGS, type Settings } from '@/lib/types';

/** The feature switches; changes apply immediately. */
export function FeatureToggles() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    settingsItem.getValue().then((s) => {
      setSettings({ ...DEFAULT_SETTINGS, ...s });
      setLoaded(true);
    });
  }, []);

  const update = async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await settingsItem.setValue(next);
  };

  if (!loaded) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-3">
      <Toggle
        id="psr-auto-login"
        label="Auto login"
        hint="Fill and submit the PolyU ADFS sign-in form"
        checked={settings.autoLogin}
        onChange={(autoLogin) => update({ autoLogin })}
      />
      <Toggle
        id="psr-enhance-search"
        label="Enhanced subject search"
        hint="Searchable dropdowns and expandable result rows"
        checked={settings.enhanceSearch}
        onChange={(enhanceSearch) => update({ enhanceSearch })}
      />
      <Toggle
        id="psr-my-courses"
        label="My Courses panel"
        hint="Floating panel on eStudent and the subject search"
        checked={settings.showMyCourses}
        onChange={(showMyCourses) => update({ showMyCourses })}
      />
      <Toggle
        id="psr-auto-register"
        label="Auto subject registration"
        hint="Fills the registration form and adds your picks to the cart"
        caution="Off by default — it acts on the real registration pages"
        checked={settings.autoRegister}
        onChange={(autoRegister) => update({ autoRegister })}
      />
    </div>
  );
}

interface ToggleProps {
  id: string;
  label: string;
  hint: string;
  /** Second line, for switches whose consequences are worth spelling out. */
  caution?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Toggle({ id, label, hint, caution, checked, onChange }: ToggleProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-normal">
          {label}
        </Label>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
        {caution && (
          <p className="text-[11px] text-destructive/80">{caution}</p>
        )}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
