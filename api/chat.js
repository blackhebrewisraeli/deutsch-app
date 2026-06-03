// Vercel Serverless Function — proxies Anthropic API calls server-side.
// The API key stays on the server and never reaches the browser.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'VITE_ANTHROPIC_API_KEY is not set on the server.' });
  }

  const requestBody = typeof req.body === 'string'
    ? req.body
    : JSON.stringify(req.body);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: requestBody,
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('Function error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
