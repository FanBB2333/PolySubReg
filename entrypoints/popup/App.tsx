import { ExternalLink, GraduationCap, Globe, Lock, Settings } from 'lucide-react';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CredentialsSection } from '@/components/settings/CredentialsSection';
import { FeatureToggles } from '@/components/settings/FeatureToggles';

const ESTUDENT_URL =
  'https://www38.polyu.edu.hk/eStudent/secure/information/subject-search.jsf';
const EPUBLIC_URL = 'https://www38.polyu.edu.hk/ePublic/subject-search.jsf';

export function App() {
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

      <div className="space-y-1.5">
        <div className="grid grid-cols-2 gap-2">
          <Button asChild>
            <a href={ESTUDENT_URL} target="_blank" rel="noreferrer">
              <Lock className="size-3.5" /> eStudent
            </a>
          </Button>
          <Button variant="secondary" asChild>
            <a href={EPUBLIC_URL} target="_blank" rel="noreferrer">
              <Globe className="size-3.5" /> ePublic
            </a>
          </Button>
        </div>
        <p className="text-center text-[11px] text-muted-foreground">
          Subject search — ePublic needs no sign-in
        </p>
      </div>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-sm font-medium">eStudent credentials</h2>
        <CredentialsSection />
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Features</h2>
        <FeatureToggles />
      </section>

      <Separator />

      <Button
        variant="outline"
        className="w-full"
        onClick={() => browser.runtime.openOptionsPage()}
      >
        <Settings className="size-3.5" /> Full settings (search defaults…)
        <ExternalLink className="size-3 opacity-60" />
      </Button>
    </div>
  );
}
