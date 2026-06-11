const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// The one upstream call. Returns { status, data }; throws on network failure
// (the handler maps that to a 502 envelope).
export async function forwardToAnthropic(safeBody, apiKey) {
  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(safeBody),
  });
  const data = await response.json();
  return { status: response.status, data };
}
