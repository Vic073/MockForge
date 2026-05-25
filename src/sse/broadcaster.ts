import type { Response } from 'express';
import type { LogEvent } from '../../shared/types.js';

const clients = new Set<Response>();

const broadcaster = {
  addClient(res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    clients.add(res);
    res.write(': connected\n\n');
    res.on('close', () => clients.delete(res));
  },

  emit(data: LogEvent): void {
    const payload = `event: request\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of clients) {
      client.write(payload);
    }
  },
};

export default broadcaster;
