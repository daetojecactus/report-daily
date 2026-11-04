import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const restrictImports = (groups, message) => ({
  'no-restricted-imports': [
    'error',
    { patterns: [{ group: groups, message }] },
  ],
});

const noComments = {
  meta: {
    type: 'problem',
    schema: [],
    messages: { comment: 'Comments are not allowed, explain the code in docs' },
  },
  create: (context) => ({
    Program: () => {
      for (const comment of context.sourceCode.getAllComments()) {
        context.report({ loc: comment.loc, messageId: 'comment' });
      }
    },
  }),
};

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'dist/**', 'coverage/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: globals.node,
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    plugins: { local: { rules: { 'no-comments': noComments } } },
    rules: {
      'local/no-comments': 'error',
      'no-console': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
  {
    files: ['src/common/**/*.ts'],
    ignores: ['src/**/__test__/**'],
    rules: restrictImports(['src/modules/**'], 'common does not depend on modules'),
  },
  {
    files: ['src/modules/infrastructure/**/*.ts'],
    ignores: ['src/**/__test__/**'],
    rules: restrictImports(
      [
        'src/modules/api/**',
        'src/modules/application/**',
        'src/modules/queue/**',
        'src/modules/tasks/**',
        'src/modules/vendors/**',
      ],
      'infrastructure does not know about domains, transport and vendors',
    ),
  },
  {
    files: ['src/modules/vendors/**/*.ts'],
    ignores: ['src/**/__test__/**'],
    rules: restrictImports(
      [
        'src/modules/api/**',
        'src/modules/application/**',
        'src/modules/queue/**',
        'src/modules/tasks/**',
      ],
      'vendors do not know about domains and transport',
    ),
  },
  {
    files: ['src/modules/application/**/*.ts'],
    ignores: ['src/**/__test__/**'],
    rules: restrictImports(
      [
        'src/modules/api/**',
        'src/modules/tasks/**',
        'src/modules/queue/**/*.processor',
      ],
      'application does not depend on transport, tasks and queue processors',
    ),
  },
  {
    files: ['src/modules/queue/**/*.ts'],
    ignores: ['src/**/__test__/**'],
    rules: restrictImports(
      [
        'src/modules/api/**',
        'src/modules/tasks/**',
        'src/modules/application/**/*.repository',
      ],
      'queue processors call application services and vendors only',
    ),
  },
  {
    files: ['src/modules/tasks/**/*.ts'],
    ignores: ['src/**/__test__/**'],
    rules: restrictImports(
      [
        'src/modules/api/**',
        'src/modules/application/**',
        'src/modules/queue/**/*.processor',
      ],
      'tasks declare schedules through queue producers only',
    ),
  },
  {
    files: ['src/modules/api/**/*.ts'],
    ignores: ['src/**/__test__/**'],
    rules: restrictImports(
      [
        'src/modules/tasks/**',
        'src/modules/queue/**/*.processor',
        'src/modules/infrastructure/database/**',
        'src/modules/application/**/*.repository',
        'drizzle-orm',
        'drizzle-orm/*',
        'pg',
        'ioredis',
      ],
      'api passes updates to application services and queues only',
    ),
  },
);
