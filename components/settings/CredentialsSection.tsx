import { useEffect, useState } from 'react';
import { Check, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { credentialsItem } from '@/lib/storage';
import {
  adfsUsername,
  DEFAULT_CREDENTIALS,
  type Credentials,
} from '@/lib/types';

/** NetID / domain / password fields with an explicit save. */
export function CredentialsSection() {
  const [credentials, setCredentials] = useState<Credentials>(DEFAULT_CREDENTIALS);
  const [showPassword, setShowPassword] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    credentialsItem.getValue().then((c) => {
      setCredentials({ ...DEFAULT_CREDENTIALS, ...c });
      setLoaded(true);
    });
  }, []);

  const save = async () => {
    await credentialsItem.setValue(credentials);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!loaded) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Stored with <code>storage.local</code> on this device only — never
        synced to your Google account.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="psr-netid" className="text-xs">
          NetID
        </Label>
        <Input
          id="psr-netid"
          value={credentials.netId}
          placeholder="12345678d"
          autoComplete="off"
          onChange={(e) =>
            setCredentials({ ...credentials, netId: e.target.value.trim() })
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="psr-domain" className="text-xs">
          Sign-in domain{' '}
          <span className="font-normal text-muted-foreground">
            (leave empty for the default)
          </span>
        </Label>
        <Input
          id="psr-domain"
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
        <Label htmlFor="psr-password" className="text-xs">
          Password
        </Label>
        <div className="relative">
          <Input
            id="psr-password"
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
    </div>
  );
}
