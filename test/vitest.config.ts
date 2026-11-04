import path from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: path.resolve(import.meta.dirname, '..'),
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
          useDefineForClassFields: false,
        },
        keepClassNames: true,
        target: 'es2022',
      },
      module: { type: 'es6' },
    }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/__test__/*.spec.ts'],
          exclude: ['src/**/__test__/*.int.spec.ts'],
          setupFiles: ['reflect-metadata'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['src/**/__test__/*.int.spec.ts'],
          globalSetup: ['test/setup/global-setup.ts'],
          setupFiles: ['reflect-metadata', 'test/setup/env.ts'],
          fileParallelism: false,
          testTimeout: 30000,
          hookTimeout: 120000,
        },
      },
    ],
  },
});
