import type { ParsedField, ParsedSchema, RouteDefinition } from '../../shared/types.js';

function scalarType(field: ParsedField): { type: string; format?: string } {
  const type = field.type.toLowerCase();
  if (type === 'uuid') return { type: 'string', format: 'uuid' };
  if (['date', 'datetime'].includes(type)) return { type: 'string', format: 'date-time' };
  if (['int', 'number'].includes(type)) return { type: 'integer' };
  if (type === 'float') return { type: 'number' };
  if (['boolean', 'bool'].includes(type)) return { type: 'boolean' };
  return { type: 'string' };
}

function schemaForModel(fields: Record<string, ParsedField>): unknown {
  return {
    type: 'object',
    properties: Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, scalarType(field)])),
    required: Object.keys(fields).filter((field) => field === 'id'),
  };
}

function operationId(route: RouteDefinition): string {
  const suffix = route.path.includes(':id') ? 'ById' : '';
  return `${route.method.toLowerCase()}${route.model}${suffix}`;
}

function pathToOpenApi(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

export function generateOpenApi(schema: ParsedSchema, routes: RouteDefinition[], port: number): unknown {
  const components = Object.fromEntries(Object.entries(schema).map(([name, fields]) => [name, schemaForModel(fields)]));

  const paths = routes.reduce<Record<string, Record<string, unknown>>>((acc, route) => {
    const openPath = pathToOpenApi(route.path);
    const modelName = Object.keys(schema).find((name) => route.model === `${name.toLowerCase()}s`) ?? route.model;
    const hasId = route.path.includes(':id');
    const mutates = ['POST', 'PUT', 'PATCH'].includes(route.method);

    acc[openPath] ??= {};
    acc[openPath][route.method.toLowerCase()] = {
      operationId: operationId(route),
      tags: [route.model],
      parameters: hasId ? [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] : [],
      requestBody: mutates ? {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${modelName}` },
          },
        },
      } : undefined,
      responses: {
        200: {
          description: 'Successful response',
          content: {
            'application/json': {
              schema: route.method === 'GET' && !hasId
                ? { type: 'array', items: { $ref: `#/components/schemas/${modelName}` } }
                : { $ref: `#/components/schemas/${modelName}` },
            },
          },
        },
        201: route.method === 'POST' ? { description: 'Created' } : undefined,
        400: { description: 'Bad request' },
        404: { description: 'Not found' },
        500: { description: 'Injected or server error' },
      },
    };
    return acc;
  }, {});

  return {
    openapi: '3.1.0',
    info: {
      title: 'MockForge API',
      version: '1.0.0',
      description: 'Generated mock API from the active MockForge schema.',
    },
    servers: [{ url: `http://localhost:${port}` }],
    paths,
    components: { schemas: components },
  };
}
