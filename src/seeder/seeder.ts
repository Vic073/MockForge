import pluralize from 'pluralize';
import type { ParsedSchema, SeededRecord, SeededStore } from '../../shared/types.js';
import { resolveGenerator } from './typeMap.js';

function slugFor(modelName: string): string {
  return pluralize(modelName.toLowerCase());
}

export function seedSchema(schema: ParsedSchema, count: number): SeededStore {
  const store: SeededStore = {};

  for (const [modelName, fields] of Object.entries(schema)) {
    const slug = slugFor(modelName);
    store[slug] = Array.from({ length: count }, () => {
      const idField = fields.id;
      const id = String(idField ? resolveGenerator('id', idField.type)() : crypto.randomUUID());
      return { id };
    });
  }

  for (const [modelName, fields] of Object.entries(schema)) {
    const slug = slugFor(modelName);
    store[slug] = store[slug].map((record, index) => {
      const next: SeededRecord = { ...record };
      for (const [fieldName, field] of Object.entries(fields)) {
        if (fieldName === 'id') continue;
        if (field.isRelation && field.relationModel) {
          const related = store[slugFor(field.relationModel)];
          if (related?.length) {
            next[fieldName] = related[index % related.length].id;
            continue;
          }
        }
        next[fieldName] = resolveGenerator(fieldName, field.type)();
      }
      return next;
    });
  }

  return store;
}

export function seedModelBySlug(schema: ParsedSchema, slug: string, count: number, existing: SeededStore): SeededRecord[] | null {
  const entry = Object.entries(schema).find(([modelName]) => slugFor(modelName) === slug);
  if (!entry) return null;
  const [modelName, fields] = entry;
  const seeded = seedSchema({ [modelName]: fields }, count);
  const records = seeded[slugFor(modelName)];

  return records.map((record, index) => {
    const next = { ...record };
    for (const [fieldName, field] of Object.entries(fields)) {
      if (fieldName === 'id') continue;
      if (field.isRelation && field.relationModel) {
        const related = existing[slugFor(field.relationModel)];
        if (related?.length) {
          next[fieldName] = related[index % related.length].id;
        }
      }
    }
    return next;
  });
}
