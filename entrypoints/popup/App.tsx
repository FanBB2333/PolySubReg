import { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, ExternalLink, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { credentialsItem, settingsItem } from '@/lib/storage';
import {
  adfsUsername,
  DEFAULT_CREDENTIALS,
  DEFAULT_SETTINGS,
  type Credentials,
  type Settings,
} from '@/lib/types';

const SUBJECT_SEARCH_URL =
  'https://www38.polyu.edu.hk/eStudent/secure/information/subject-search.jsf';

export function App() {
  const [credentials, setCredentials] = useState<Credentials>(DEFAULT_CREDENTIALS);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [showPassword, setShowPassword] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([credentialsItem.getValue(), settingsItem.getValue()]).then(
      ([c, s]) => {
        setCredentials({ ...DEFAULT_CREDENTIALS, ...c });
        setSettings({ ...DEFAULT_SETTINGS, ...s });
        setLoaded(true);
      },
    );
  }, []);

  // Toggles apply immediately; only the credential fields need an explicit save.
  const updateSetting = async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await settingsItem.setValue(next);
  };

  const save = async () => {
    await credentialsItem.setValue(credentials);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!loaded) return <div className="w-88 p-4 text-sm">Loading…</div>;

  return (
    <div className="w-88 space-y-4 p-4">
      <header className="flex items-center gap-2">
        <GraduationCap className="size-5 text-primary" />
        <div>
          <h1 className="text-base leading-tight font-semibold">PolySubReg</h1>
          <p className="text-xs text-muted-foreground">
            PolyU subject registration helper
          </p>
        </div>
      </header>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-sm font-medium">eStudent credentials</h2>
        <p className="text-xs text-muted-foreground">
          Stored with <code>storage.local</code> on this device only — never
          synced to your Google account.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="netid" className="text-xs">
            NetID
          </Label>
          <Input
            id="netid"
            value={credentials.netId}
            placeholder="12345678d"
            autoComplete="off"
            onChange={(e) =>
              setCredentials({ ...credentials, netId: e.target.value.trim() })
            }
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="domain" className="text-xs">
            Sign-in domain{' '}
            <span className="font-normal text-muted-foreground">
              (leave empty for the default)
            </span>
          </Label>
          <Input
            id="domain"
            value={credentials.domain}
            placeholder={'empty = hh\\NetID'}
            autoComplete="off"
            onChange={(e) =>
              setCredentials({ ...credentials, domain: e.target.value.trim() })
            }
          />
          <p className="text-[11px] text-muted-foreground">
            Will sign in as{' '}
            <span className="font-mono">
              {adfsUsername({
                ...credentials,
                netId: credentials.netId || 'netid',
              })}
            </span>
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs">
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={credentials.password}
              autoComplete="off"
              className="pr-9"
              onChange={(e) =>
                setCredentials({ ...credentials, password: e.target.value })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-0.5 right-0.5 size-8 text-muted-foreground"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </Button>
          </div>
        </div>

        <Button className="w-full" onClick={save}>
          {saved ? (
            <>
              <Check className="size-4" /> Saved
            </>
          ) : (
            'Save credentials'
          )}
        </Button>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Features</h2>
        <Toggle
          id="auto-login"
          label="Auto login"
          hint="Fill and submit the PolyU ADFS sign-in form"
          checked={settings.autoLogin}
          onChange={(autoLogin) => updateSetting({ autoLogin })}
        />
        <Toggle
          id="enhance-search"
          label="Enhanced subject search"
          hint="Searchable dropdowns and expandable result rows"
          checked={settings.enhanceSearch}
          onChange={(enhanceSearch) => updateSetting({ enhanceSearch })}
        />
        <Toggle
          id="my-courses"
          label="My Courses panel"
          hint="Floating panel on eStudent pages"
          checked={settings.showMyCourses}
          onChange={(showMyCourses) => updateSetting({ showMyCourses })}
        />
      </section>

      <Separator />

      <Button variant="outline" className="w-full" asChild>
        <a href={SUBJECT_SEARCH_URL} target="_blank" rel="noreferrer">
          Open subject search <ExternalLink className="size-3.5" />
        </a>
      </Button>
    </div>
  );
}

interface ToggleProps {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Toggle({ id, label, hint, checked, onChange }: ToggleProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-normal">
          {label}
        </Label>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
