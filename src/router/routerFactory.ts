import { Router } from 'express';
import pluralize from 'pluralize';
import type { ParsedSchema, RouteDefinition, SeededRecord } from '../../shared/types.js';
import { clearMutationHistory, cloneRecord, recordMutation } from '../history/history.js';
import store from '../state/store.js';

const methods = ['GET', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export function slugFor(modelName: string): string {
  return pluralize(modelName.toLowerCase());
}

export function createRouteDefinitions(schema: ParsedSchema): RouteDefinition[] {
  return Object.keys(schema).flatMap((modelName) => {
    const model = slugFor(modelName);
    const paths = [`/api/${model}`, `/api/${model}/:id`, `/api/${model}`, `/api/${model}/:id`, `/api/${model}/:id`, `/api/${model}/:id`];
    return methods.map((method, index) => ({ method, path: paths[index], model }));
  });
}

function selectFields(records: SeededRecord[], fields: string[]): SeededRecord[] {
  if (fields.length === 0) return records;
  return records.map((record) => {
    const selected: SeededRecord = { id: String(record.id) };
    for (const field of fields) {
      if (field in record) selected[field] = record[field];
    }
    return selected;
  });
}

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true });
}

function filterAndPaginate(records: SeededRecord[], query: Record<string, unknown>): SeededRecord[] {
  const page = Math.max(Number(query._page ?? 1), 1);
  const limit = Math.max(Number(query._limit ?? records.length), 1);
  const search = String(query._search ?? '').trim().toLowerCase();
  const filtered = records.filter((record) =>
    Object.entries(query).every(([key, value]) => {
      if (key.startsWith('_')) return true;
      return String(record[key]) === String(value);
    }) &&
    (!search || Object.values(record).some((value) => typeof value === 'string' && value.toLowerCase().includes(search))),
  );

  const sortField = typeof query._sort === 'string' ? query._sort : '';
  if (sortField) {
    const direction = query._order === 'desc' ? -1 : 1;
    filtered.sort((a, b) => compareValues(a[sortField], b[sortField]) * direction);
  }

  const start = (page - 1) * limit;
  const fields = typeof query._fields === 'string' ? query._fields.split(',').map((field) => field.trim()).filter(Boolean) : [];
  return selectFields(filtered.slice(start, start + limit), fields);
}

function findRelationField(parentModel: string, childRecord: SeededRecord): string | null {
  const singular = pluralize.singular(parentModel);
  const candidates = [`${singular}Id`, `${singular}_id`];
  return candidates.find((candidate) => candidate in childRecord) ?? null;
}

export function createCrudRouter(): Router {
  const router = Router();

  router.get('/:model', (req, res) => {
    const records = store.model(req.params.model);
    if (!records) {
      res.status(404).json({ error: `Model '${req.params.model}' not found`, available: Object.keys(store.all()) });
      return;
    }
    res.json(filterAndPaginate(records, req.query));
  });

  router.get('/:model/:id', (req, res) => {
    const records = store.model(req.params.model);
    const record = records?.find((item) => item.id === req.params.id);
    if (!record) {
      res.status(404).json({ error: `Record '${req.params.id}' not found` });
      return;
    }
    res.json(record);
  });

  router.get('/:model/:id/:childModel', (req, res) => {
    const parent = store.model(req.params.model)?.find((item) => item.id === req.params.id);
    const childRecords = store.model(req.params.childModel);
    if (!parent || !childRecords) {
      res.status(404).json({ error: 'Nested resource not found' });
      return;
    }
    const relationField = childRecords.length ? findRelationField(req.params.model, childRecords[0]) : null;
    if (!relationField) {
      res.status(404).json({ error: `No relation from ${req.params.childModel} to ${req.params.model}` });
      return;
    }
    res.json(filterAndPaginate(childRecords.filter((record) => record[relationField] === parent.id), req.query));
  });

  router.post('/:model', (req, res) => {
    const records = store.model(req.params.model);
    if (!records) {
      res.status(404).json({ error: `Model '${req.params.model}' not found`, available: Object.keys(store.all()) });
      return;
    }
    if (!req.body || Object.keys(req.body).length === 0) {
      res.status(400).json({ error: 'Request body cannot be empty' });
      return;
    }
    const record = { id: crypto.randomUUID(), ...req.body };
    records.push(record);
    recordMutation({ method: 'POST', model: req.params.model, recordId: String(record.id), before: null, after: cloneRecord(record) });
    res.status(201).json(record);
  });

  router.put('/:model/:id', (req, res) => {
    const records = store.model(req.params.model);
    const index = records?.findIndex((item) => item.id === req.params.id) ?? -1;
    if (!records || index < 0) {
      res.status(404).json({ error: `Record '${req.params.id}' not found` });
      return;
    }
    const before = cloneRecord(records[index]);
    records[index] = { id: req.params.id, ...req.body };
    recordMutation({ method: 'PUT', model: req.params.model, recordId: req.params.id, before, after: cloneRecord(records[index]) });
    res.json(records[index]);
  });

  router.patch('/:model/:id', (req, res) => {
    const records = store.model(req.params.model);
    const index = records?.findIndex((item) => item.id === req.params.id) ?? -1;
    if (!records || index < 0) {
      res.status(404).json({ error: `Record '${req.params.id}' not found` });
      return;
    }
    const before = cloneRecord(records[index]);
    records[index] = { ...records[index], ...req.body, id: req.params.id };
    recordMutation({ method: 'PATCH', model: req.params.model, recordId: req.params.id, before, after: cloneRecord(records[index]) });
    res.json(records[index]);
  });

  router.delete('/:model/:id', (req, res) => {
    const records = store.model(req.params.model);
    const index = records?.findIndex((item) => item.id === req.params.id) ?? -1;
    if (!records || index < 0) {
      res.status(404).json({ error: `Record '${req.params.id}' not found` });
      return;
    }
    const [removed] = records.splice(index, 1);
    recordMutation({ method: 'DELETE', model: req.params.model, recordId: req.params.id, before: cloneRecord(removed), after: null });
    res.json(removed);
  });

  return router;
}

export { clearMutationHistory };
