import { describe, it, expect } from 'vitest';
import { legalRouteFor } from './legalRoute';

describe('legalRouteFor', () => {
  it('matches the bare paths', () => {
    expect(legalRouteFor({ pathname: '/privacy', hash: '' })).toBe('privacy');
    expect(legalRouteFor({ pathname: '/terms', hash: '' })).toBe('terms');
  });

  it('treats a trailing slash as the same route', () => {
    expect(legalRouteFor({ pathname: '/privacy/', hash: '' })).toBe('privacy');
  });

  it('accepts the hash fallback, for hosts with no SPA rewrite', () => {
    expect(legalRouteFor({ pathname: '/', hash: '#/privacy' })).toBe('privacy');
    expect(legalRouteFor({ pathname: '/', hash: '#/terms' })).toBe('terms');
  });

  it('does not claim the app root or unrelated routes', () => {
    expect(legalRouteFor({ pathname: '/', hash: '' })).toBeNull();
    expect(legalRouteFor({ pathname: '/vocab', hash: '' })).toBeNull();
    // The settings hash must keep working — it is a different router.
    expect(legalRouteFor({ pathname: '/', hash: '#/settings' })).toBeNull();
  });

  it('does not match a path that merely contains a route name', () => {
    expect(legalRouteFor({ pathname: '/privacy-policy', hash: '' })).toBeNull();
    expect(legalRouteFor({ pathname: '/app/terms', hash: '' })).toBeNull();
  });

  it('tolerates an empty location', () => {
    expect(legalRouteFor({})).toBeNull();
    expect(legalRouteFor()).toBeNull();
  });
});
