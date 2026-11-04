import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/modules/**/*.schema.ts',
  out: './src/modules/infrastructure/database/migrations',
  casing: 'snake_case',
  strict: true,
});
