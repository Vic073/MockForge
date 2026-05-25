import type { RouteDefinition } from '../../shared/types.js';

export function generateMswHandlers(routes: RouteDefinition[], port: number): string {
  const imports = `import { http, HttpResponse } from 'msw';`;
  const handlers = routes.map((route) => {
    const method = route.method.toLowerCase();
    const url = `http://localhost:${port}${route.path.replace(':id', ':id')}`;
    return `  http.${method}('${url}', () => HttpResponse.json({ mockedBy: 'MockForge' }))`;
  });
  return `${imports}\n\nexport const handlers = [\n${handlers.join(',\n')}\n];\n`;
}
