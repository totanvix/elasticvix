import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Elasticvix',
    description: 'Elasticsearch query console with field-aware autocomplete and saved queries.',
    permissions: ['storage'],
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    action: {},
  },
});
