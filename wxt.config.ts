import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // WXT defaults to `.output`, which macOS hides from the file picker you use to
  // load an unpacked extension. Not `dist` — that collides with Vite's own
  // default output directory and breaks the entry file name resolution.
  outDir: 'build',
  // Don't spawn a throwaway Chrome for `wxt dev`. Its automation flags trigger
  // Chrome's "unsupported command-line flag" banner and it starts from an empty
  // profile every time, which means signing in to eStudent again on each run.
  // Load `build/chrome-mv3-dev` into your own Chrome instead — the dev server
  // still rebuilds and reloads the extension on save.
  webExt: {
    disabled: true,
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'PSR - PolySubReg',
    description:
      'PolyU subject registration helper: auto login, enhanced subject search, and a My Courses panel.',
    permissions: ['storage'],
    host_permissions: [
      'https://www38.polyu.edu.hk/*',
      'https://adfs.polyu.edu.hk/*',
    ],
    action: {
      default_title: 'PolySubReg',
    },
  },
});
