import ReactDOM from 'react-dom/client';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { getSettings } from '@/lib/storage';
import { App } from './App';
import '@/assets/tailwind.css';

/**
 * Adds the floating "My Courses" launcher to every eStudent page, plus the
 * anonymous ePublic subject search — anywhere a course can be added, the panel
 * should be reachable. It is mounted in a shadow root so PolyU's global
 * stylesheet — which styles bare `table`, `div` and `button` elements
 * aggressively — cannot reach it.
 */
export default defineContentScript({
  matches: [
    'https://www38.polyu.edu.hk/eStudent/*',
    'https://www38.polyu.edu.hk/ePublic/subject-search.jsf*',
  ],
  cssInjectionMode: 'ui',
  runAt: 'document_idle',

  async main(ctx) {
    const settings = await getSettings();
    if (!settings.showMyCourses) return;

    const ui = await createShadowRootUi(ctx, {
      name: 'psr-my-courses',
      position: 'overlay',
      // The launcher and the panel are both `position: fixed`, so the overlay
      // wrapper itself must not intercept clicks meant for the page.
      alignment: 'top-right',
      anchor: 'body',
      onMount: (container) => {
        const root = ReactDOM.createRoot(container);
        root.render(<App />);
        return root;
      },
      onRemove: (root) => root?.unmount(),
    });

    ui.mount();
  },
});
