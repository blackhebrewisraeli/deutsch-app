import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callClaude } from './claude';

describe('callClaude', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              content: [
                { type: 'text', text: 'Hallo' },
                { type: 'tool_use', id: 'x' },
                { type: 'text', text: ' Welt' },
              ],
            }),
        })
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs system prompt, user message, and history to the API URL', async () => {
    const history = [{ role: 'assistant', content: 'Hi' }];
    const result = await callClaude('You are a tutor', 'Wie geht es dir?', history);

    expect(result).toBe('Hallo\n Welt');
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toMatch(/\/api\//);
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.system).toBe('You are a tutor');
    expect(body.messages).toEqual([
      { role: 'assistant', content: 'Hi' },
      { role: 'user', content: 'Wie geht es dir?' },
    ]);
    expect(body.model).toBe('claude-haiku-4-5-20251001');
  });

  it('throws with API status and message on non-OK response', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ error: { message: 'overloaded' } }),
    });

    await expect(callClaude('sys', 'user')).rejects.toThrow('API call failed (503): overloaded');
  });

  it('falls back to stringified error body when message is missing', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ reason: 'bad request' }),
    });

    await expect(callClaude('sys', 'user')).rejects.toThrow('API call failed (400)');
  });

  it('handles unparseable error JSON gracefully', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('invalid json')),
    });

    await expect(callClaude('sys', 'user')).rejects.toThrow('API call failed (500): {}');
  });
});
