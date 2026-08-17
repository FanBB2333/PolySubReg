import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
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
