import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    files: [
      'src/lib/auth/**/*.{ts,tsx}',
      'src/lib/money/**/*.{ts,tsx}',
      'src/lib/orders/**/*.{ts,tsx}',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'node_modules/**']),
]);

export default eslintConfig;
