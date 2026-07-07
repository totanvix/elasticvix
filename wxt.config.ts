import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'VixElastic',
    description: 'Elasticsearch query console with field-aware autocomplete and saved queries.',
    permissions: ['storage'],
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    action: {}, // no default_popup: icon click opens a full-page tab (background handles it)
  },
});
