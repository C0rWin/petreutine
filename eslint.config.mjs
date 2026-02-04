// Frontend ESLint flat config with TypeScript + React
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  // Global ignores
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', 'server/**'],
  },
  // Base configs
  eslint.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  // React config for .tsx and .jsx files
  {
    files: ['**/*.tsx', '**/*.jsx'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // Not needed with React 17+
      'react-hooks/exhaustive-deps': 'warn', // Keep as warning - useful but not blocking
      // Disable experimental rules that have false positives
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off', // Too strict - Date.now() fallback is fine
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  // Import sorting
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
  // TypeScript-specific rules
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      // Frontend: TypeScript inference is sufficient for most cases
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'off', // Common in React with controlled state
      '@typescript-eslint/no-empty-function': 'off', // Needed for mock stubs
      '@typescript-eslint/no-invalid-void-type': 'off', // Needed for API return types
      'no-console': 'error',
      'prefer-const': 'error',
    },
  },
  // Test files - relaxed rules
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**', '**/setup.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      'no-console': 'off',
    },
  },
  // Prettier must be last
  eslintConfigPrettier
);
