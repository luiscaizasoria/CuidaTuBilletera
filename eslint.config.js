import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '**/coverage/',
      '**/.expo/',
      '**/.wrangler/',
      '**/worker-configuration.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.js'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
  },
  {
    files: ['app/app.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { process: 'readonly', module: 'writable' },
    },
  },
  prettier,
);
