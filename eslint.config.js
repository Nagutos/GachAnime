import js from '@eslint/js'
import vueI18n from '@intlify/eslint-plugin-vue-i18n'
import prettier from 'eslint-config-prettier'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const WEB_SOURCES = ['apps/web/**/*.vue', 'apps/web/**/*.ts']
const LOCALE_FILES = 'apps/web/src/locales/*.json'

/** The vue-i18n plugin configs target every file by default: restrict them to the web app. */
function scopeToWebApp(config) {
  if (!config.files) return [{ ...config, files: [...WEB_SOURCES, LOCALE_FILES] }]
  if (config.files.some((pattern) => pattern.includes('json'))) {
    return [{ ...config, files: [LOCALE_FILES] }]
  }
  return [] // YAML locale files are not used.
}

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.next-e2e/**',
      '**/coverage/**',
      '**/next-env.d.ts',
      'packages/db/migrations/**',
      'e2e/playwright-report/**',
      'e2e/test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'vue/multi-word-component-names': 'off',
    },
  },
  // UI text must come from translation keys: no raw strings in Vue templates.
  ...vueI18n.configs.recommended.flatMap(scopeToWebApp),
  {
    files: [...WEB_SOURCES, LOCALE_FILES],
    settings: {
      'vue-i18n': { localeDir: 'apps/web/src/locales/*.json', messageSyntaxVersion: '^11.0.0' },
    },
    rules: {
      '@intlify/vue-i18n/no-raw-text': ['error', { ignorePattern: '^[-#:()&·/0-9↑↓✕]+$' }],
      '@intlify/vue-i18n/no-missing-keys': 'error',
      '@intlify/vue-i18n/no-dynamic-keys': 'off',
    },
  },
  prettier,
)
