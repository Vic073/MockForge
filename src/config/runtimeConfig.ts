import type { RuntimeConfig } from '../../shared/types.js';

export const runtimeConfig: RuntimeConfig = {
  globalDelayMs: 0,
  routeDelays: {},
  chaosRate: 0,
  rateLimitPerMinute: null,
  authRequired: false,
  authToken: 'mockforge-dev-token',
};

export function updateRuntimeConfig(patch: Partial<RuntimeConfig>): RuntimeConfig {
  if (typeof patch.globalDelayMs === 'number') {
    runtimeConfig.globalDelayMs = Math.max(0, patch.globalDelayMs);
  }
  if (patch.routeDelays && typeof patch.routeDelays === 'object') {
    runtimeConfig.routeDelays = Object.fromEntries(
      Object.entries(patch.routeDelays).map(([route, delay]) => [route, Math.max(0, Number(delay) || 0)]),
    );
  }
  if (typeof patch.chaosRate === 'number') {
    runtimeConfig.chaosRate = Math.min(Math.max(patch.chaosRate, 0), 1);
  }
  if (patch.rateLimitPerMinute === null || typeof patch.rateLimitPerMinute === 'number') {
    runtimeConfig.rateLimitPerMinute = patch.rateLimitPerMinute === null ? null : Math.max(1, patch.rateLimitPerMinute);
  }
  if (typeof patch.authRequired === 'boolean') {
    runtimeConfig.authRequired = patch.authRequired;
  }
  if (typeof patch.authToken === 'string' && patch.authToken.trim()) {
    runtimeConfig.authToken = patch.authToken.trim();
  }
  return runtimeConfig;
}
