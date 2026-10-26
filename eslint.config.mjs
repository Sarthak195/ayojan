import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import tseslint from 'typescript-eslint';

// The pure-core boundary below is the architecture: decisions live in src/core, which
// cannot import I/O, frameworks or SDKs, nor read the clock or randomness, so every
// decision is reproducible in a unit test with no network and no mocks.
const PURE_CORE_IMPORTS = [
  'node:*',
  'fs',
  'path',
  'crypto',
  'react',
  'react-dom',
  'next',
  'next/*',
  '@google/genai',
  'yaml',
  'pino',
  'server-only',
  '@/server/*',
  '@/app/*',
  '@/components/*',
];

export default defineConfig([
  globalIgnores(['.next/**', 'coverage/**', 'node_modules/**', 'next-env.d.ts']),
  ...nextVitals,
  {
    // The App Router has no pages/ directory, and the rule warns on every run when it finds none.
    rules: { '@next/next/no-html-link-for-pages': 'off' },
  },
  {
    files: ['**/*.{ts,tsx,mts}'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: PURE_CORE_IMPORTS,
              message:
                'src/core is pure: no I/O, framework or SDK. Move this to src/server and pass the result in.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'src/core must be deterministic: take `today: Date` as a parameter.',
        },
        {
          selector: "MemberExpression[object.name='Date'][property.name='now']",
          message: 'src/core must be deterministic: inject the clock as a parameter.',
        },
        {
          selector: "MemberExpression[object.name='Math'][property.name='random']",
          message: 'src/core must be deterministic: inject randomness as a parameter.',
        },
      ],
    },
  },
  {
    // Tests and scripts are ordinary Node programs: they print and need no module-boundary types.
    files: ['scripts/**/*.{ts,mts,mjs}', 'tests/**/*.ts', '*.config.{ts,mts,mjs}'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
  {
    // Plain JavaScript sits outside the TypeScript program, so type-aware rules cannot run on it.
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
]);
