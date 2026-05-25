import type { ParsedField, ParsedSchema } from '../../shared/types.js';

function tsType(field: ParsedField): string {
  const type = field.type.toLowerCase();
  if (['int', 'number', 'float', 'price', 'amount'].includes(type)) return 'number';
  if (['boolean', 'bool'].includes(type)) return 'boolean';
  return 'string';
}

export function generateTypeScript(schema: ParsedSchema): string {
  return Object.entries(schema)
    .map(([modelName, fields]) => {
      const body = Object.entries(fields)
        .map(([fieldName, field]) => `  ${fieldName}: ${tsType(field)};`)
        .join('\n');
      return `export interface ${modelName} {\n${body}\n}`;
    })
    .join('\n\n');
}
