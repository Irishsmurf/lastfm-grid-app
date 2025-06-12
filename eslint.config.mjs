import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'; // Import Prettier plugin

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  // Add a custom configuration object for TypeScript rules
  {
    files: ['**/*.ts', '**/*.tsx'], // Apply to TypeScript files
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn', // or "error"
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // You can add other rule overrides here if needed
    },
  },
  // Configuration specifically for test files to allow `any`
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // Add Prettier plugin configuration. This should be last.
  // eslint-plugin-prettier/recommended effectively adds eslint-config-prettier and sets up prettier/prettier rule
  eslintPluginPrettierRecommended,
];

export default eslintConfig;
