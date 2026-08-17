import { defineContentScript } from 'wxt/utils/define-content-script';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { getSettings } from '@/lib/storage';
import { applySearchDefaults } from './defaults';
import { enhanceResults } from './results';
import { enhanceSelects } from './selects';
import { injectPageCss } from './page.css';
import '@/assets/tailwind.css';

export default defineContentScript({
  matches: [
    'https://www38.polyu.edu.hk/ePublic/subject-search.jsf*',
    'https://www38.polyu.edu.hk/eStudent/secure/information/subject-search.jsf*',
  ],
  cssInjectionMode: 'ui',
  runAt: 'document_idle',

  async main(ctx) {
    // Defaults are their own feature: they apply even with the visual
    // enhancement toggled off. May trigger the page's own auto-submit reload
    // (Academic Year/Semester); everything below simply runs again after it.
    await applySearchDefaults();

    const settings = await getSettings();
    if (!settings.enhanceSearch) return;

    injectPageCss();
    await enhance(ctx);

    // RichFaces swaps the result table out via AJAX when the user pages through
    // results, which drops everything we injected. Re-run on any change to the
    // form, debounced so a burst of mutations costs one pass.
    const form = document.querySelector('form#mainForm');
    if (!form) return;

    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        void enhance(ctx);
      });
    });
    observer.observe(form, { childList: true, subtree: true });
    ctx.onInvalidated(() => observer.disconnect());
  },
});

async function enhance(ctx: ContentScriptContext): Promise<void> {
  try {
    await enhanceSelects(ctx);
    await enhanceResults(ctx);
  } catch (error) {
    console.error('[PSR] failed to enhance the subject search page:', error);
  }
}
