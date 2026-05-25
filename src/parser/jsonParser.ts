import fs from 'node:fs';
import path from 'node:path';
import type { ParsedSchema } from '../../shared/types.js';

function normalizeSchema(input: unknown): ParsedSchema {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Schema must be a JSON object with one or more models.');
  }

  const schema: ParsedSchema = {};
  for (const [modelName, fields] of Object.entries(input as Record<string, unknown>)) {
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      throw new Error(`Model "${modelName}" must be an object of field names to type strings.`);
    }

    const parsedFields = Object.entries(fields as Record<string, unknown>)
      .filter(([, fieldType]) => typeof fieldType === 'string')
      .reduce<ParsedSchema[string]>((acc, [fieldName, fieldType]) => {
        const isRelation = /(?:Id|_id)$/.test(fieldName) && fieldName !== 'id';
        const baseName = fieldName.replace(/(?:Id|_id)$/, '');
        acc[fieldName] = {
          type: String(fieldType).toLowerCase(),
          isRelation,
          relationModel: isRelation ? baseName.charAt(0).toUpperCase() + baseName.slice(1) : undefined,
        };
        return acc;
      }, {});

    if (Object.keys(parsedFields).length > 0) {
      schema[modelName] = parsedFields;
    }
  }

  if (Object.keys(schema).length === 0) {
    throw new Error('Schema contains no models. Nothing to generate.');
  }

  return schema;
}

export function parseJsonSchemaValue(input: unknown): ParsedSchema {
  return normalizeSchema(input);
}

export function parseJsonSchema(schemaPath: string): ParsedSchema {
  const resolved = path.resolve(schemaPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Schema file not found at ${schemaPath}`);
  }

  const raw = fs.readFileSync(resolved, 'utf8').trim();
  if (!raw) {
    throw new Error('Schema file is empty.');
  }

  let parsed: unknown = JSON.parse(raw);
  if (typeof parsed === 'string') {
    parsed = JSON.parse(parsed);
  }

  return normalizeSchema(parsed);
}
