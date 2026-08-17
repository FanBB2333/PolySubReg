import { ExternalLink, GraduationCap, Settings } from 'lucide-react';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CredentialsSection } from '@/components/settings/CredentialsSection';
import { FeatureToggles } from '@/components/settings/FeatureToggles';

const SUBJECT_SEARCH_URL =
  'https://www38.polyu.edu.hk/eStudent/secure/information/subject-search.jsf';

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

      <div className="space-y-2">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => browser.runtime.openOptionsPage()}
        >
          <Settings className="size-3.5" /> Full settings (search defaults…)
        </Button>
        <Button variant="outline" className="w-full" asChild>
          <a href={SUBJECT_SEARCH_URL} target="_blank" rel="noreferrer">
            Open subject search <ExternalLink className="size-3.5" />
          </a>
        </Button>
      </div>
    </div>
  );
}
