export interface ParsedField {
  type: string;
  isRelation?: boolean;
  relationModel?: string;
}

export type ParsedModel = Record<string, ParsedField>;
export type ParsedSchema = Record<string, ParsedModel>;

export interface SeededRecord {
  id: string;
  [key: string]: unknown;
}

export type SeededStore = Record<string, SeededRecord[]>;

export interface LogEvent {
  method: string;
  path: string;
  status: number;
  ms: number;
  timestamp: string;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  model: string;
}

export interface StatsResponse {
  models: Record<string, number>;
  totalRecords: number;
  totalRequests: number;
  uptime: number;
  port: number;
}

export interface ResetResponse {
  restored: Record<string, number>;
  totalRecords: number;
}

export interface RuntimeConfig {
  globalDelayMs: number;
  routeDelays: Record<string, number>;
  chaosRate: number;
  rateLimitPerMinute: number | null;
  authRequired: boolean;
  authToken: string;
}

export interface RequestSnapshot {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  timestamp: string;
}

export interface MutationHistoryEntry {
  id: string;
  model: string;
  recordId: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  before: SeededRecord | null;
  after: SeededRecord | null;
  timestamp: string;
}
