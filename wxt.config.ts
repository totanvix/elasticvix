import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Elasticvix - Elasticsearch Client',
    description:
      'Elasticsearch client with query console, field-aware autocomplete, saved queries, and multi-cluster support. For ES 6.x-9.x.',
    permissions: ['storage'],
    host_permissions: ['http://*/*', 'https://*/*'],
    action: {},
  },
});
