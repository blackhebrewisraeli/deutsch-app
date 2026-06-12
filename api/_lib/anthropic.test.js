import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { forwardToAnthropic } from './anthropic.js';

const body = { model: 'claude-haiku-4-5-20251001', max_tokens: 10, messages: [] };

describe('forwardToAnthropic', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ status: 200, json: () => Promise.resolve({ content: [] }) }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs the body to the messages API with key and version headers', async () => {
    const { status, data } = await forwardToAnthropic(body, 'secret-key');
    expect(status).toBe(200);
    expect(data).toEqual({ content: [] });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(options.method).toBe('POST');
    expect(options.headers['x-api-key']).toBe('secret-key');
    expect(options.headers['anthropic-version']).toBe('2023-06-01');
    expect(JSON.parse(options.body)).toEqual(body);
  });

  it('returns upstream error statuses with their payload', async () => {
    fetch.mockResolvedValueOnce({
      status: 529,
      json: () => Promise.resolve({ type: 'error', error: { type: 'overloaded_error' } }),
    });
    const { status, data } = await forwardToAnthropic(body, 'k');
    expect(status).toBe(529);
    expect(data.error.type).toBe('overloaded_error');
  });

  it('propagates network failures to the caller', async () => {
    fetch.mockRejectedValueOnce(new Error('socket hang up'));
    await expect(forwardToAnthropic(body, 'k')).rejects.toThrow('socket hang up');
  });
});
