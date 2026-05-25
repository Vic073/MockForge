import chalk from 'chalk';
import type { NextFunction, Request, Response } from 'express';
import type { LogEvent } from '../../shared/types.js';
import broadcaster from '../sse/broadcaster.js';

let totalRequests = 0;

function colorStatus(status: number): string {
  if (status < 300) return chalk.green(String(status));
  if (status < 400) return chalk.yellow(String(status));
  return chalk.red(String(status));
}

export function getTotalRequests(): number {
  return totalRequests;
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = performance.now();
  res.on('finish', () => {
    if (req.path === '/api/_logs/stream') return;
    const event: LogEvent = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      ms: Math.round(performance.now() - start),
      timestamp: new Date().toISOString(),
    };
    totalRequests += 1;
    console.log(`[${event.method.padEnd(6)}] ${colorStatus(event.status)} ${event.path.padEnd(28)} ${event.ms}ms`);
    broadcaster.emit(event);
  });
  next();
}
