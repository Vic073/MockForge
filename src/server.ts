import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import chalk from 'chalk';
import { faker } from '@faker-js/faker';
import type { ParsedSchema, SeededStore } from '../shared/types.js';
import { runtimeConfig, updateRuntimeConfig } from './config/runtimeConfig.js';
import { generateMswHandlers } from './exporters/msw.js';
import { generateOpenApi } from './exporters/openapi.js';
import { generatePostmanCollection } from './exporters/postman.js';
import { generateTypeScript } from './exporters/typescript.js';
import { getMutationHistory, getRequestSnapshots } from './history/history.js';
import { getTotalRequests, requestLogger } from './logger/logger.js';
import { requestInspector } from './middleware/requestInspector.js';
import { simulationMiddleware } from './middleware/simulation.js';
import { parseJsonSchema, parseJsonSchemaValue } from './parser/jsonParser.js';
import { createCrudRouter, createRouteDefinitions } from './router/routerFactory.js';
import { seedModelBySlug, seedSchema } from './seeder/seeder.js';
import broadcaster from './sse/broadcaster.js';
import store from './state/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ServerOptions {
  seed?: number;
  port?: number;
  open?: boolean;
  delay?: number;
  chaos?: number;
  rateLimit?: number;
  auth?: boolean;
  token?: string;
  fixtures?: string;
  watch?: boolean;
  seedKey?: number;
}

let currentSchema: ParsedSchema;
let seedCount = 10;
let boundPort = 5000;
let startedAt = Date.now();

interface ProjectBundle {
  version: 1;
  exportedAt: string;
  schema: ParsedSchema;
  seedCount: number;
  runtimeConfig: typeof runtimeConfig;
  data: SeededStore;
  baseline: SeededStore;
  snapshots: Record<string, SeededStore>;
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function normalizeFixtureData(input: unknown): SeededStore {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Fixture file must be a JSON object keyed by model route name.');
  }
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).filter(([, value]) => Array.isArray(value)),
  ) as SeededStore;
}

function applySchema(schema: ParsedSchema, fixtures?: SeededStore): void {
  currentSchema = schema;
  const generated = seedSchema(schema, seedCount);
  store.init({ ...generated, ...fixtures });
}

function exportProjectBundle(): ProjectBundle {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    schema: currentSchema,
    seedCount,
    runtimeConfig,
    data: store.all(),
    baseline: store.exportBaseline(),
    snapshots: store.exportSnapshots(),
  };
}

function normalizeProjectSchema(input: unknown): ParsedSchema {
  const parsed = parseJsonSchemaValue(
    Object.fromEntries(Object.entries(input as Record<string, Record<string, unknown>>).map(([model, fields]) => [
      model,
      Object.fromEntries(Object.entries(fields ?? {}).map(([fieldName, field]) => [
        fieldName,
        typeof field === 'string' ? field : (field as { type?: unknown })?.type ?? 'string',
      ])),
    ])),
  );
  return parsed;
}

function importProjectBundle(input: unknown): ProjectBundle {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Project config must be a JSON object.');
  }
  const bundle = input as Partial<ProjectBundle>;
  if (!bundle.schema) {
    throw new Error('Project config is missing "schema".');
  }

  currentSchema = normalizeProjectSchema(bundle.schema);
  seedCount = typeof bundle.seedCount === 'number' ? Math.max(1, bundle.seedCount) : seedCount;
  if (bundle.runtimeConfig) updateRuntimeConfig(bundle.runtimeConfig);

  const generated = seedSchema(currentSchema, seedCount);
  const data = bundle.data && typeof bundle.data === 'object' ? bundle.data : generated;
  const baseline = bundle.baseline && typeof bundle.baseline === 'object' ? bundle.baseline : data;
  const snapshots = bundle.snapshots && typeof bundle.snapshots === 'object' ? bundle.snapshots : {};
  store.importState(data, baseline, snapshots);
  return exportProjectBundle();
}

function diffSchemas(before: ParsedSchema | undefined, after: ParsedSchema): unknown {
  const oldModels = new Set(Object.keys(before ?? {}));
  const newModels = new Set(Object.keys(after));
  const fieldChanges = Object.fromEntries(Object.entries(after).map(([model, fields]) => {
    const previous = before?.[model] ?? {};
    return [model, {
      added: Object.keys(fields).filter((field) => !(field in previous)),
      removed: Object.keys(previous).filter((field) => !(field in fields)),
    }];
  }));
  return {
    addedModels: [...newModels].filter((model) => !oldModels.has(model)),
    removedModels: [...oldModels].filter((model) => !newModels.has(model)),
    fields: fieldChanges,
  };
}

function listenOnAvailablePort(app: express.Express, startPort: number): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const tryPort = (port: number) => {
      if (port > 5010) {
        reject(new Error('No available port found between 5000 and 5010.'));
        return;
      }

      const server = app.listen(port);
      server.once('listening', () => {
        boundPort = port;
        resolve(server);
      });
      server.once('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          tryPort(port + 1);
          return;
        }
        reject(error);
      });
    };
    tryPort(startPort);
  });
}

function printStartup(): void {
  const routes = createRouteDefinitions(currentSchema);
  const models = Object.keys(store.all());
  console.log(chalk.yellow('\nMockForge v1.0.0'));
  console.log(`Parsed ${models.length} models: ${models.join(', ')}`);
  console.log(`Seeded ${seedCount} records per model (${store.totalRecords()} total)\n`);
  if (runtimeConfig.authRequired) {
    console.log(`Auth token ${chalk.yellow(`Bearer ${runtimeConfig.authToken}`)}`);
  }
  if (runtimeConfig.globalDelayMs || runtimeConfig.chaosRate || runtimeConfig.rateLimitPerMinute) {
    console.log(`Simulation delay=${runtimeConfig.globalDelayMs}ms chaos=${runtimeConfig.chaosRate} rateLimit=${runtimeConfig.rateLimitPerMinute ?? 'off'}`);
  }
  console.log(`Mock API  ${chalk.green(`http://localhost:${boundPort}/api`)}`);
  console.log(`Dashboard ${chalk.green(`http://localhost:${boundPort}/dashboard`)}\n`);
  for (const route of routes) {
    console.log(`[${route.method.padEnd(6)}] ${route.path}`);
  }
  console.log(chalk.dim('\nWatching for requests...\n'));
}

export async function startServer(schemaPath = 'schema.json', options: ServerOptions = {}): Promise<http.Server> {
  seedCount = options.seed ?? 10;
  if (typeof options.seedKey === 'number') faker.seed(options.seedKey);
  updateRuntimeConfig({
    globalDelayMs: options.delay ?? 0,
    chaosRate: options.chaos ?? 0,
    rateLimitPerMinute: options.rateLimit ?? null,
    authRequired: options.auth ?? false,
    authToken: options.token,
  });
  const fixtureData = options.fixtures ? normalizeFixtureData(readJsonFile(options.fixtures)) : undefined;
  applySchema(parseJsonSchema(schemaPath), fixtureData);
  startedAt = Date.now();

  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    next();
  });
  app.options(/.*/, (_req, res) => res.sendStatus(204));
  app.use(requestLogger);
  app.use(requestInspector);
  app.use(simulationMiddleware);

  app.get('/api/_config', (_req, res) => res.json(runtimeConfig));
  app.post('/api/_config', (req, res) => res.json(updateRuntimeConfig(req.body)));
  app.post('/api/_config/delay', (req, res) => {
    const routeDelays = req.body?.routeDelays ?? req.body ?? {};
    res.json(updateRuntimeConfig({ routeDelays, globalDelayMs: typeof req.body?.globalDelayMs === 'number' ? req.body.globalDelayMs : undefined }));
  });
  app.get('/api/_routes', (_req, res) => res.json(createRouteDefinitions(currentSchema)));
  app.get('/api/_stats', (_req, res) => {
    res.json({
      models: store.counts(),
      totalRecords: store.totalRecords(),
      totalRequests: getTotalRequests(),
      uptime: Math.floor((Date.now() - startedAt) / 1000),
      port: boundPort,
    });
  });
  app.get('/api/_schema', (_req, res) => res.json(currentSchema));
  app.get('/api/_project', (_req, res) => res.json(exportProjectBundle()));
  app.post('/api/_project/import', (req, res) => {
    try {
      res.json(importProjectBundle(req.body));
    } catch (error) {
      res.status(400).json({ error: 'Invalid project config', detail: error instanceof Error ? error.message : String(error) });
    }
  });
  app.post('/api/_schema/reload', (req, res) => {
    try {
      const previous = currentSchema;
      const nextSchema = parseJsonSchemaValue(req.body);
      applySchema(nextSchema);
      res.json({ ok: true, models: Object.keys(store.all()), records: store.counts(), diff: diffSchemas(previous, nextSchema) });
    } catch (error) {
      res.status(400).json({ error: 'Invalid schema JSON', detail: error instanceof Error ? error.message : String(error) });
    }
  });
  app.post('/api/reset', (_req, res) => {
    const restored = store.reset();
    res.json({ restored, totalRecords: store.totalRecords() });
  });
  app.post('/api/reset/:model', (req, res) => {
    const seeded = seedModelBySlug(currentSchema, req.params.model, seedCount, store.all());
    const count = store.resetModel(req.params.model, seeded ?? undefined);
    if (!count) {
      res.status(404).json({ error: `Model '${req.params.model}' not found` });
      return;
    }
    res.json({ model: req.params.model, restored: count });
  });
  app.get('/api/_snapshots', (_req, res) => res.json(store.listSnapshots()));
  app.post('/api/_snapshots/:name', (req, res) => res.status(201).json({ name: req.params.name, models: store.saveSnapshot(req.params.name) }));
  app.post('/api/_snapshots/:name/restore', (req, res) => {
    const restored = store.restoreSnapshot(req.params.name);
    if (!restored) {
      res.status(404).json({ error: `Snapshot '${req.params.name}' not found` });
      return;
    }
    res.json({ name: req.params.name, restored });
  });
  app.get('/api/_history', (_req, res) => res.json(getMutationHistory()));
  app.get('/api/_requests', (_req, res) => res.json(getRequestSnapshots()));
  app.get('/api/_types', (_req, res) => res.type('text/plain').send(generateTypeScript(currentSchema)));
  app.get('/api/_export/openapi.json', (_req, res) => res.json(generateOpenApi(currentSchema, createRouteDefinitions(currentSchema), boundPort)));
  app.get('/api/_export/postman', (_req, res) => res.json(generatePostmanCollection(createRouteDefinitions(currentSchema), boundPort)));
  app.get('/api/_export/msw', (_req, res) => res.type('text/plain').send(generateMswHandlers(createRouteDefinitions(currentSchema), boundPort)));
  app.get('/api/_logs/stream', (_req, res) => broadcaster.addClient(res));
  app.use('/api', createCrudRouter());

  const dashboardDist = path.resolve(__dirname, '../../dashboard/dist');
  if (fs.existsSync(dashboardDist)) {
    app.use('/dashboard', express.static(dashboardDist));
    app.get(/^\/dashboard(?:\/.*)?$/, (_req, res) => res.sendFile(path.join(dashboardDist, 'index.html')));
  } else {
    console.warn(chalk.yellow('Warning: Dashboard build not found. Run npm run build to enable /dashboard.'));
  }

  const server = await listenOnAvailablePort(app, options.port ?? 5000);
  if (options.watch !== false) {
    fs.watchFile(path.resolve(schemaPath), { interval: 500 }, () => {
      try {
        const previous = currentSchema;
        applySchema(parseJsonSchema(schemaPath), fixtureData);
        console.log(chalk.yellow(`Schema changed. Reloaded ${Object.keys(currentSchema).length} models.`));
        broadcaster.emit({
          method: 'WATCH',
          path: schemaPath,
          status: 200,
          ms: 0,
          timestamp: new Date().toISOString(),
        });
        void previous;
      } catch (error) {
        console.error(chalk.red(`Schema watch reload failed: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
  }
  printStartup();
  if (options.open) {
    const { default: open } = await import('open');
    await open(`http://localhost:${boundPort}/dashboard`);
  }
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer().catch((error) => {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  });
}
