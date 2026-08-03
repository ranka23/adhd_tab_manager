/** @type {import('eslint').Linter.Config} */
const path = require('path');

module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    webextensions: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    // Explicit absolute root so typed linting resolves the same regardless
    // of the cwd ESLint is launched from (CLI vs editor language server).
    tsconfigRootDir: path.resolve(__dirname),
    project: ['./tsconfig.eslint.json'],
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'warn',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
  },
  ignorePatterns: ['dist', 'dist-firefox', 'dist-safari', 'coverage', 'artifacts', 'node_modules', '!.eslintrc.cjs'],
  overrides: [
    // This config file itself is CJS (module.exports), not part of the
    // tsconfig program. Lint it with plain parsing and Node globals so the
    // editor doesn't report it as ignored-by-default.
    {
      files: ['.eslintrc.cjs'],
      parserOptions: { project: null },
      env: { node: true },
      rules: {
        // CJS config files legitimately use require().
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
    // Node build/test/script files: plain ESM, not part of any tsconfig
    // program, so disable type-aware (project) parsing for them. Rules tuned
    // for a typed React codebase are relaxed here: console output is the CLI
    // interface, and `ok ? pass() : fail()` assertion ternaries are idiomatic.
    {
      files: ['scripts/**/*.mjs'],
      parserOptions: { project: null },
      env: { node: true },
      rules: {
        'no-console': 'off',
        'no-unused-expressions': 'off',
        '@typescript-eslint/no-unused-expressions': 'off',
        'no-empty': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
      },
    },
    // Browser-side plain JS loaded by extension pages (MV3 CSP forbids
    // inline scripts). Same treatment: no tsconfig program to type-check.
    {
      files: ['public/*.js'],
      parserOptions: { project: null },
      env: { browser: true, webextensions: true },
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
        ],
      },
    },
  ],
};
