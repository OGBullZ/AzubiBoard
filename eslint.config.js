import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'vendor/**', 'node_modules/**', '.design-sync/**', '.ds-sync/**', 'ds-bundle/**']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  {
    // src/ ist seit der TS-Migration 100% .ts/.tsx — eigener Block, damit der
    // Linter (inkl. react-hooks) den Quellcode wieder abdeckt.
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      // Boundary-any ist im Projekt bewusst+dokumentiert (JS-Boundaries store/trash/dataService,
      // Blob↔Schema-Divergenz, Consumer-eigene Typen). tsc --noEmit (strict) ist das Typ-Gate.
      '@typescript-eslint/no-explicit-any': 'off',
      // ID-Mismatch-Schutz: currentUser.id ist je nach Modus string (Blob) oder number (API).
      // Roh === gegen gespeicherte IDs = der wiederkehrende Bug aus den Bug-Hunts → sameId() erzwingen.
      'no-restricted-syntax': ['error', {
        selector: "BinaryExpression[operator=/^[!=]==$/] > MemberExpression[property.name='id'][object.name='currentUser']",
        message: 'currentUser.id mit sameId() vergleichen, nicht roh ===/!== — IDs sind je nach Modus string oder number (Bug-Hunt 3).',
      }, {
        // currentUser?.id (Optional-Chaining) ist ein ChainExpression-Kind, nicht direkt unter der BinaryExpression
        // → der Selector oben greift nicht. Zweiter Selector schließt das Schlupfloch (Bug-Hunt 6).
        selector: "BinaryExpression[operator=/^[!=]==$/] > ChainExpression > MemberExpression[property.name='id'][object.name='currentUser']",
        message: 'currentUser?.id mit sameId() vergleichen, nicht roh ===/!== — IDs sind je nach Modus string oder number (Bug-Hunt 3).',
      }],
    },
  },
  {
    files: ['*.config.{js,mjs}', 'vite.config.js', 'playwright.config.js', 'lighthouserc.cjs'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ['tests/**/*.{js,jsx}', 'e2e/**/*.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.vitest },
    },
  },
])
