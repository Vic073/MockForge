import type { NextFunction, Request, Response } from 'express';
import { recordRequest } from '../history/history.js';

export function requestInspector(req: Request, _res: Response, next: NextFunction): void {
  if (req.path.startsWith('/api') && req.path !== '/api/_logs/stream') {
    recordRequest({
      method: req.method,
      path: req.originalUrl,
      headers: req.headers,
      body: req.body,
    });
  }
  next();
}
