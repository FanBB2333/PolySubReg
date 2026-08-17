import { ExternalLink, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CredentialsSection } from '@/components/settings/CredentialsSection';
import { FeatureToggles } from '@/components/settings/FeatureToggles';
import { SearchDefaultsSection } from '@/components/settings/SearchDefaultsSection';

const SUBJECT_SEARCH_URL =
  'https://www38.polyu.edu.hk/eStudent/secure/information/subject-search.jsf';

export function App() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
            <GraduationCap className="size-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl leading-tight font-semibold">
              PolySubReg Settings
            </h1>
            <p className="text-sm text-muted-foreground">
              PolyU subject registration helper
            </p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <a href={SUBJECT_SEARCH_URL} target="_blank" rel="noreferrer">
            Open subject search <ExternalLink className="size-3.5" />
          </a>
        </Button>
      </header>

      <Section
        title="Search defaults"
        description="Pre-selected criteria for the subject search page"
      >
        <SearchDefaultsSection />
      </Section>

      <Section
        title="Features"
        description="Turn individual parts of the extension on or off"
      >
        <FeatureToggles />
      </Section>

      <Section
        title="eStudent credentials"
        description="Used by auto login on the PolyU ADFS sign-in page"
      >
        <CredentialsSection />
      </Section>
    </div>
  );
}

interface SectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function Section({ title, description, children }: SectionProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 border-l-4 border-primary pl-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}
