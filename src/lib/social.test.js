import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./authedFetch.js', async (importOriginal) => ({
  ...(await importOriginal()),
  authedFetch: vi.fn(),
}));

import {
  searchUsers,
  followUser,
  unfollowUser,
  listFollows,
  isSearchable,
  MIN_QUERY_LEN,
} from './social';
import { authedFetch } from './authedFetch.js';

const ok = (body) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });
const failure = (message) => ({
  ok: false,
  status: 400,
  json: () => Promise.resolve({ error: { message } }),
});

const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('isSearchable', () => {
  it('needs the minimum, ignoring surrounding space', () => {
    expect(isSearchable('a')).toBe(false);
    expect(isSearchable(' a ')).toBe(false);
    expect(isSearchable('ab')).toBe(true);
    expect(isSearchable('  ab  ')).toBe(true);
    expect(MIN_QUERY_LEN).toBe(2);
  });

  it('is false for anything that is not a string', () => {
    expect(isSearchable(undefined)).toBe(false);
    expect(isSearchable(null)).toBe(false);
    expect(isSearchable(12)).toBe(false);
  });
});

describe('searchUsers', () => {
  it('url-encodes the term rather than splicing it into the query string', async () => {
    authedFetch.mockResolvedValue(ok({ results: [] }));
    await searchUsers('a&b=c d');

    expect(authedFetch).toHaveBeenCalledWith(
      '/api/v1/social?q=a%26b%3Dc%20d',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('returns the results array', async () => {
    authedFetch.mockResolvedValue(ok({ results: [{ user_id: ID, handle: 'sam' }] }));
    expect(await searchUsers('sam')).toEqual([{ user_id: ID, handle: 'sam' }]);
  });

  it('returns an empty list when the body has no results array', async () => {
    authedFetch.mockResolvedValue(ok({}));
    expect(await searchUsers('sam')).toEqual([]);
  });

  it('throws the server’s wording on failure', async () => {
    authedFetch.mockResolvedValue(failure('Too many requests — slow down.'));
    await expect(searchUsers('sam')).rejects.toThrow('Too many requests — slow down.');
  });
});

describe('followUser', () => {
  it('posts the target in the body', async () => {
    authedFetch.mockResolvedValue(ok({ user_id: ID, is_following: true }));
    await followUser(ID);

    const [url, init] = authedFetch.mock.calls[0];
    expect(url).toBe('/api/v1/social');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ userId: ID });
  });

  it('throws the server’s wording on failure', async () => {
    authedFetch.mockResolvedValue(failure('You cannot follow yourself.'));
    await expect(followUser(ID)).rejects.toThrow('You cannot follow yourself.');
  });
});

describe('unfollowUser', () => {
  it('names the target in the query, because DELETE carries no body', async () => {
    authedFetch.mockResolvedValue(ok({ user_id: ID, is_following: false }));
    await unfollowUser(ID);

    expect(authedFetch).toHaveBeenCalledWith(
      `/api/v1/social?userId=${ID}`,
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('throws the server’s wording on failure', async () => {
    authedFetch.mockResolvedValue(failure('Could not unfollow.'));
    await expect(unfollowUser(ID)).rejects.toThrow('Could not unfollow.');
  });
});

describe('listFollows', () => {
  it('asks for the named list at offset 0 by default', async () => {
    authedFetch.mockResolvedValue(ok({ results: [], hasMore: false }));
    await listFollows('followers');

    expect(authedFetch).toHaveBeenCalledWith(
      '/api/v1/social?list=followers&offset=0',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('carries the offset for the next page', async () => {
    authedFetch.mockResolvedValue(ok({ results: [], hasMore: false }));
    await listFollows('following', { offset: 20 });

    expect(authedFetch).toHaveBeenCalledWith(
      '/api/v1/social?list=following&offset=20',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('returns results and hasMore', async () => {
    authedFetch.mockResolvedValue(ok({ results: [{ user_id: ID, handle: 'sam' }], hasMore: true }));
    expect(await listFollows('followers')).toEqual({
      results: [{ user_id: ID, handle: 'sam' }],
      hasMore: true,
    });
  });

  it('defaults to an empty page when the body is malformed', async () => {
    authedFetch.mockResolvedValue(ok({}));
    expect(await listFollows('followers')).toEqual({ results: [], hasMore: false });
  });

  it('throws the server’s wording on failure', async () => {
    authedFetch.mockResolvedValue(failure('Could not load that list.'));
    await expect(listFollows('followers')).rejects.toThrow('Could not load that list.');
  });
});
