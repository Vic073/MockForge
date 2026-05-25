import type { NextFunction, Request, Response } from 'express';
import { runtimeConfig } from '../config/runtimeConfig.js';

const buckets = new Map<string, { minute: number; count: number }>();

function routeKey(req: Request): string {
  return `${req.method} ${req.path}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isControlPath(path: string): boolean {
  return path.startsWith('/api/_config') || path.startsWith('/api/_logs/stream');
}

export async function simulationMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.method === 'OPTIONS' || isControlPath(req.path)) {
    next();
    return;
  }

  if (runtimeConfig.authRequired && req.path.startsWith('/api') && !req.path.startsWith('/api/_')) {
    const expected = `Bearer ${runtimeConfig.authToken}`;
    if (req.headers.authorization !== expected) {
      res.status(401).json({ error: 'Unauthorized', detail: `Send Authorization: ${expected}` });
      return;
    }
  }

  if (runtimeConfig.rateLimitPerMinute && req.path.startsWith('/api') && !req.path.startsWith('/api/_')) {
    const key = req.ip ?? 'local';
    const minute = Math.floor(Date.now() / 60000);
    const bucket = buckets.get(key);
    if (!bucket || bucket.minute !== minute) {
      buckets.set(key, { minute, count: 1 });
    } else {
      bucket.count += 1;
      if (bucket.count > runtimeConfig.rateLimitPerMinute) {
        res.status(429).json({ error: 'Too Many Requests', limit: runtimeConfig.rateLimitPerMinute });
        return;
      }
    }
  }

  const configuredDelay = runtimeConfig.routeDelays[routeKey(req)] ?? runtimeConfig.globalDelayMs;
  if (configuredDelay > 0) {
    await delay(configuredDelay);
  }

  if (runtimeConfig.chaosRate > 0 && req.path.startsWith('/api') && !req.path.startsWith('/api/_') && Math.random() < runtimeConfig.chaosRate) {
    res.status(500).json({ error: 'Injected chaos failure', chaosRate: runtimeConfig.chaosRate });
    return;
  }

  next();
}
