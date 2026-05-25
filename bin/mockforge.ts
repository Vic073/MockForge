#!/usr/bin/env node
import { Command } from 'commander';
import { startServer } from '../src/server.js';

const program = new Command();

program
  .name('mockforge')
  .description('Schema-driven mock API and dashboard')
  .argument('[schema]', 'Path to a JSON schema file', 'schema.json')
  .option('-p, --port <port>', 'Preferred port', (value) => Number(value), 5000)
  .option('-s, --seed <count>', 'Records to seed per model', (value) => Number(value), 10)
  .option('--seed-key <key>', 'Deterministic Faker seed key', (value) => Number(value))
  .option('--delay <ms>', 'Global response delay in milliseconds', (value) => Number(value), 0)
  .option('--chaos <rate>', 'Random failure rate between 0 and 1', (value) => Number(value), 0)
  .option('--rate-limit <count>', 'Requests per minute before 429 responses', (value) => Number(value))
  .option('--auth', 'Require Authorization: Bearer token for model API routes', false)
  .option('--token <token>', 'Fixed fake auth token', 'mockforge-dev-token')
  .option('--fixtures <path>', 'JSON fixture data file keyed by route model name')
  .option('--no-watch', 'Disable schema file watch mode')
  .option('--open', 'Open the dashboard after startup', false)
  .action(async (schema: string, options: { port: number; seed: number; open: boolean; delay: number; chaos: number; rateLimit?: number; auth: boolean; token: string; fixtures?: string; watch: boolean; seedKey?: number }) => {
    await startServer(schema, options);
  });

program.parseAsync().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
