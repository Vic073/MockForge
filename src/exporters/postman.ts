import type { RouteDefinition } from '../../shared/types.js';

export function generatePostmanCollection(routes: RouteDefinition[], port: number): unknown {
  return {
    info: {
      name: 'MockForge API',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: routes.map((route) => ({
      name: `${route.method} ${route.path}`,
      request: {
        method: route.method,
        header: ['POST', 'PUT', 'PATCH'].includes(route.method)
          ? [{ key: 'Content-Type', value: 'application/json' }]
          : [],
        url: {
          raw: `http://localhost:${port}${route.path.replace(':id', '{{id}}')}`,
          protocol: 'http',
          host: ['localhost'],
          port: String(port),
          path: route.path.replace('/api/', 'api/').replace(':id', '{{id}}').split('/'),
        },
        body: ['POST', 'PUT', 'PATCH'].includes(route.method)
          ? { mode: 'raw', raw: '{}', options: { raw: { language: 'json' } } }
          : undefined,
      },
    })),
  };
}
