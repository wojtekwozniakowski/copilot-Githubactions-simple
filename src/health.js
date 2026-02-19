export function getRuntimeHealth() {
  const hasFetch = typeof fetch === 'function';
  const hasNavigator = typeof navigator !== 'undefined';

  if (hasFetch && hasNavigator) {
    return { ok: true, message: 'Runtime healthy: required browser APIs are available.' };
  }

  return { ok: false, message: 'Runtime degraded: expected browser APIs are missing.' };
}
