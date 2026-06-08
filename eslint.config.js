import js from '@eslint/js';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

export default [
  // Base JS recommended rules
  js.configs.recommended,

  // React files
  {
    files: ['**/*.{js,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    settings: {
      react: { version: '18.3' },
    },
    rules: {
      // React — core rules (manual, avoids flat-config compat issues in eslint-plugin-react v7)
      'react/jsx-uses-react': 'off',          // not needed React 17+
      'react/react-in-jsx-scope': 'off',      // not needed React 17+
      'react/jsx-uses-vars': 'error',         // prevent false "unused" on JSX vars
      'react/no-unknown-property': 'error',   // catch typos in DOM props
      'react/jsx-key': 'error',               // missing key in list items
      'react/no-direct-mutation-state': 'error',
      'react/no-deprecated': 'warn',

      // Hooks — most important for catching the bugs our code reviews flagged
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',  // warn so we can fix incrementally

      // Fast refresh (Vite HMR)
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // General JS quality
      'no-unused-vars': ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  // Server-side files: Vercel serverless functions and build/config scripts
  // run in Node, not the browser — give them Node globals (process, etc.).
  {
    files: ['api/**/*.js', '*.config.js', 'scripts/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Turn off ESLint rules that conflict with Prettier formatting (must be last)
  prettier,
];
